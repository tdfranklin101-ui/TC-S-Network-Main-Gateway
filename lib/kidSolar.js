import { getWallet } from './ledger.js';

export async function kidSolarRespond(walletId, inputText) {
  if (/balance/i.test(inputText)) {
    const wallet = getWallet(walletId);
    const balance = wallet ? wallet.balance.toFixed(4) : "0.0000";
    return `Wallet ${walletId}: You have ${balance} Solar tokens available.`;
  }
  if (/list energy/i.test(inputText)) {
    return "Say: 'List REC 500 0.15' to list 500 kWh at 0.15 Rays/kWh";
  }
  const match = inputText.match(/list (rec|ppa) (\d+) ([\d.]+)/i);
  if (match) {
    const [_, type, kwh, price] = match;
    return `Listing ${kwh} kWh as ${type.toUpperCase()} at ${price} Rays/kWh`;
  }
  return `I'm Kid Solar, your co-pilot. Try 'balance' or 'list energy'.`;
}
