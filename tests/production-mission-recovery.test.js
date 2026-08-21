'use strict';

// Focused restart-recovery checks for paid physical production. Run with:
//   node tests/production-mission-recovery.test.js

const assert = require('assert');
const adapterPath = require.resolve('../server/replicator/armos-adapter.js');
const productionLedger = require('../server/production-ledger.js');

async function run() {
  const snapshots = [];
  const adapter = require(adapterPath);
  const mission = adapter.createMissionRecord('Build a durable table', {
    persist: async snapshot => snapshots.push(JSON.parse(JSON.stringify(snapshot)))
  });

  mission.status = 'WAITING_APPROVAL';
  mission.engineering = { assembly: { name: 'Table', pieces: [{ label: 'top' }] } };
  mission.capsule = { mission_id: mission.mission_id, node: { node_id: 'RP-0001' }, parts: [{ part_id: 'P1' }] };
  mission.timeline.push({ stage: 'WAITING_APPROVAL', at: new Date().toISOString() });
  await adapter.persistMission(mission);
  const durableSnapshot = snapshots.at(-1);

  assert.ok(durableSnapshot, 'a mission snapshot should be written');
  assert.strictEqual(durableSnapshot.status, 'WAITING_APPROVAL');
  assert.strictEqual(durableSnapshot.capsule.node.node_id, 'RP-0001');
  assert.ok(!Object.prototype.hasOwnProperty.call(durableSnapshot, 'control_token'), 'control tokens must not enter the ledger snapshot');

  // Reloading the module gives a fresh in-memory mission store, simulating a
  // workflow restart while retaining only the ledger snapshot.
  delete require.cache[adapterPath];
  const restoredAdapter = require(adapterPath);
  const restoredSnapshots = [];
  const restored = restoredAdapter.restoreMission(durableSnapshot, {
    persist: async snapshot => restoredSnapshots.push(JSON.parse(JSON.stringify(snapshot)))
  });

  assert.ok(restored, 'a valid ledger snapshot should restore a mission');
  assert.strictEqual(restoredAdapter.getMission(mission.mission_id), restored);
  assert.strictEqual(restored.status, 'WAITING_APPROVAL');
  assert.strictEqual(restored.capsule.node.node_id, 'RP-0001');

  await restoredAdapter.executeMission(restored.mission_id);
  assert.strictEqual(restored.status, 'EXECUTING', 'a restored mission should pass the approval gate');
  assert.strictEqual(restoredSnapshots.at(-1).status, 'EXECUTING', 'approval state must be persisted before it is returned');

  await restoredAdapter.cancelMission(restored.mission_id);
  const cancelledSnapshot = restoredSnapshots.at(-1);
  assert.strictEqual(cancelledSnapshot.status, 'CANCELLED', 'cancellation must be persisted before it is returned');

  delete require.cache[adapterPath];
  const cancelledAdapter = require(adapterPath);
  const cancelledMission = cancelledAdapter.restoreMission(cancelledSnapshot);
  assert.strictEqual(cancelledMission.status, 'CANCELLED', 'a canceled mission must remain canceled after restart');
  await assert.rejects(
    () => cancelledAdapter.executeMission(cancelledMission.mission_id),
    /CANCELLED/,
    'a restored canceled mission must never pass the approval gate'
  );

  const routedSnapshot = { ...durableSnapshot, status: 'ORCHESTRATING' };
  const latestSnapshot = cancelledSnapshot;
  const state = await productionLedger.getRequest({
    query: async () => ({
      rows: [
        {
          entry_type: 'event',
          account_id: '7',
          amount: '0',
          description: 'request',
          transaction_id: 'event-1',
          created_at: '2026-08-21T00:00:00.000Z',
          metadata: { event: 'PRODUCTION_REQUEST_CREATED', seq: 1, owner_id: '7' }
        },
        {
          entry_type: 'event',
          account_id: '7',
          amount: '0',
          description: 'route',
          transaction_id: 'event-2',
          created_at: '2026-08-21T00:00:01.000Z',
          metadata: { event: 'EXECUTION_ROUTED', seq: 2, mission_snapshot: routedSnapshot }
        },
        {
          entry_type: 'event',
          account_id: '7',
          amount: '0',
          description: 'snapshot',
          transaction_id: 'event-3',
          created_at: '2026-08-21T00:00:02.000Z',
          metadata: { event: 'EXECUTION_MISSION_SNAPSHOT', seq: 3, mission: latestSnapshot }
        }
      ]
    })
  }, 'TCSPR-RECOVERY');

  assert.strictEqual(state.mission.status, 'CANCELLED', 'ledger replay should use the latest mission snapshot');
  assert.strictEqual(state.mission.mission_id, mission.mission_id);
  console.log('✓ paid physical mission snapshots survive an adapter restart and replay from the ledger');
}

run().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});