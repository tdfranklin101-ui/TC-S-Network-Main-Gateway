const COMPLIANCE_POLICY = {
  platformClassification: 'TC-S is a white-label AI marketplace economy builder. It is NOT a fiat exchange service.',
  solarPurpose: 'Solar is an internal energy-denominated unit of account for marketplace activity, intended primarily for internal circulation.',
  fiatPurpose: 'Fiat payments are value-onramps used to activate Solar balances for marketplace participation.',
  recPurpose: 'Renewable Energy Certificate contributions verify real energy generation to activate Solar according to the Solar Standard: 1 Solar = 4,913 kWh.',
  settlementDefault: 'disabled',

  prohibitedPhrases: [
    'cash out anytime',
    'guaranteed redemption',
    'convert back to dollars whenever',
    'convert Solar back to dollars whenever you want',
    'Solar is redeemable on demand',
    'passive income',
    'guaranteed returns',
    'investment yield',
    'your agent makes money for you',
    'buy redeemable Solar',
    'cash-out balance',
    'investment',
    'deposit for withdrawal',
    'instant cash out',
    'guaranteed withdrawal',
    'guaranteed cash value',
  ],

  approvedSettlementDisclaimer: 'Eligible balances may be submitted for settlement under this network\'s rules, subject to identity verification, reserve status, platform terms, and applicable law.',

  approvedMarketplaceDescription: 'TC-S networks are configured marketplaces. Fiat payments, REC contributions, sponsor allocations, or grants may activate Solar balances for use inside this network. Solar is intended for marketplace participation, including goods, services, digital assets, agent commissions, and community commerce. Settlement, if enabled, is governed by this network\'s rules.',

  closedLoopNotice: 'This network is configured as a closed-loop Solar marketplace. Solar is used for goods, services, agent commissions, and community commerce inside this network.',

  settlementDisabledNotice: 'This network does not offer cash settlement. Solar circulates inside the marketplace and may be used for approved goods, services, agent work, and digital assets.',

  platformPositioning: 'TC-S is a white-label AI marketplace economy builder. Organizations can activate private Solar-based marketplaces using fiat payments, REC contributions, sponsor funding, or grant allocations. Once activated, Solar circulates through human and AI-agent commerce, including goods, services, digital assets, and agent commissions. The platform is designed to maximize internal economic velocity rather than operate as a fiat exchange service.',

  agentMarketplaceDescription: 'Your assigned AI agent helps circulate Solar inside the network by discovering, creating, buying, selling, and commissioning useful marketplace assets.',

  orchestratorDescription: 'KID SOL coordinates specialist agents to create marketplace supply, identify demand, and support useful circulation of Solar value.',

  validSettlementModes: ['disabled', 'admin_approved', 'limited', 'compliant_partner'],

  validSettlementStatuses: ['pending', 'under_review', 'approved', 'rejected', 'processed', 'cancelled'],
};

function isSettlementEnabled(networkConfig) {
  return networkConfig && networkConfig.settlement_mode && networkConfig.settlement_mode !== 'disabled';
}

function validateSettlementMode(mode) {
  return COMPLIANCE_POLICY.validSettlementModes.includes(mode);
}

function validateSettlementStatus(status) {
  return COMPLIANCE_POLICY.validSettlementStatuses.includes(status);
}

function containsProhibitedPhrase(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return COMPLIANCE_POLICY.prohibitedPhrases.some(phrase => lower.includes(phrase.toLowerCase()));
}

module.exports = {
  COMPLIANCE_POLICY,
  isSettlementEnabled,
  validateSettlementMode,
  validateSettlementStatus,
  containsProhibitedPhrase,
};
