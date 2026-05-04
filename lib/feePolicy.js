const DEFAULT_FEE_RATES = {
  marketplaceTransactionFeePercent: 5,
  agentCommissionFeePercent: 10,
  settlementAdministrativeFeePercent: 5,
  activationProcessingFeePercent: 0,
};

const FEE_LABELS = {
  marketplace_purchase: 'Marketplace transaction fee',
  marketplace_sale: 'Marketplace transaction fee',
  agent_commission: 'Agent service fee',
  agent_trade: 'Marketplace transaction fee',
  fiat_activation: 'Activation processing fee',
  rec_activation: 'Activation processing fee',
  settlement: 'Administrative settlement fee',
  platform_fee: 'Platform fee',
  white_label: 'Network licensing fee',
};

function getNetworkFees(networkConfig) {
  if (!networkConfig || !networkConfig.network_rules) {
    return { ...DEFAULT_FEE_RATES };
  }
  const rules = typeof networkConfig.network_rules === 'string'
    ? JSON.parse(networkConfig.network_rules)
    : networkConfig.network_rules;

  return {
    marketplaceTransactionFeePercent: rules.marketplaceTransactionFeePercent ?? DEFAULT_FEE_RATES.marketplaceTransactionFeePercent,
    agentCommissionFeePercent: rules.agentCommissionFeePercent ?? DEFAULT_FEE_RATES.agentCommissionFeePercent,
    settlementAdministrativeFeePercent: rules.settlementAdministrativeFeePercent ?? DEFAULT_FEE_RATES.settlementAdministrativeFeePercent,
    activationProcessingFeePercent: rules.activationProcessingFeePercent ?? DEFAULT_FEE_RATES.activationProcessingFeePercent,
  };
}

function getFeeLabel(transactionType) {
  return FEE_LABELS[transactionType] || 'Platform fee';
}

function calculateFee(amount, feePercent) {
  return parseFloat((amount * (feePercent / 100)).toFixed(6));
}

module.exports = {
  DEFAULT_FEE_RATES,
  FEE_LABELS,
  getNetworkFees,
  getFeeLabel,
  calculateFee,
};
