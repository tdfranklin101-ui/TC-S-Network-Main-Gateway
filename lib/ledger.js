import { v4 as uuidv4 } from "uuid";

const ledger = {
  wallets: {},
  trades: [],
  energyPool: []
};

export function createWallet(walletId) {
  if (!ledger.wallets[walletId]) ledger.wallets[walletId] = { balance: 1.0 };
  return ledger.wallets[walletId];
}

export function transfer(walletId, amount) {
  const w = ledger.wallets[walletId];
  if (!w || w.balance < amount) throw new Error("Insufficient balance");
  w.balance -= amount;
  return true;
}

export function listEnergy(walletId, type, kwh, pricePerKwh) {
  const id = uuidv4();
  ledger.energyPool.push({ id, type, kwh, pricePerKwh, owner: walletId });
  return id;
}

export function matchEnergyOrders() {
  const recs = ledger.energyPool.filter(l => l.type === 'REC');
  const ppas = ledger.energyPool.filter(l => l.type === 'PPA');

  for (const buyer of ppas) {
    for (const seller of recs) {
      if (buyer.pricePerKwh >= seller.pricePerKwh && buyer.kwh > 0 && seller.kwh > 0) {
        const tradedKwh = Math.min(buyer.kwh, seller.kwh);
        const cost = tradedKwh * seller.pricePerKwh;
        ledger.trades.push({
          buyer: buyer.owner,
          seller: seller.owner,
          kwh: tradedKwh,
          price: seller.pricePerKwh,
          timestamp: Date.now()
        });
        buyer.kwh -= tradedKwh;
        seller.kwh -= tradedKwh;
      }
    }
  }
  ledger.energyPool = ledger.energyPool.filter(l => l.kwh > 0);
}

export function getEnergyMarket() {
  return { listings: ledger.energyPool, trades: ledger.trades };
}

export function getWallet(walletId) {
  return ledger.wallets[walletId] || null;
}
