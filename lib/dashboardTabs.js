const BASE_TABS = [
  { id: 'activate', label: 'Activate Solar' },
  { id: 'agent', label: 'My Agent' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'assets', label: 'My Assets' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'commission', label: 'Commission Agents' },
  { id: 'rules', label: 'Network Rules' },
];

function getDashboardTabs(networkConfig) {
  const tabs = [...BASE_TABS];

  if (networkConfig && networkConfig.allow_agent_commissions === false) {
    const idx = tabs.findIndex(t => t.id === 'commission');
    if (idx !== -1) tabs.splice(idx, 1);
  }

  if (networkConfig && networkConfig.settlement_mode && networkConfig.settlement_mode !== 'disabled') {
    tabs.push({ id: 'settlement', label: 'Settlement' });
  }

  return tabs;
}

module.exports = { BASE_TABS, getDashboardTabs };
