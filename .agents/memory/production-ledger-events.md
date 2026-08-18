---
name: Ledger event replay ordering
description: Durable principles for event-sourced state stored in the marketplace ledger
---
- **Rule:** events written inside one transaction share a timestamp and row PKs are not ordered — replay must sort on a monotonic sequence stored with each event.
- **Why:** unordered replay let a later-written terminal state be overwritten by an earlier lifecycle event.
- **How to apply:** every event writer includes a seq; every replay sorts (timestamp, seq).
- Reconciliation must be derivable from the ledger itself; in-memory retry queues don't survive restarts.
- Refunds must reverse *every* leg of the original transaction with SQL increments, and any paid-but-unrouted request needs a remediation path — otherwise a failure between charge commit and route persistence strands the buyer.
