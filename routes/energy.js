const { listEnergy, matchEnergyOrders, getEnergyMarket } = require('../lib/ledger');

module.exports = function(req, res, pathname, body) {
  if (pathname === '/energy' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getEnergyMarket()));
    return true;
  }
  
  if (pathname === '/energy/list' && req.method === 'POST') {
    const { walletId, type, kwh, pricePerKwh } = body;
    const id = listEnergy(walletId, type, kwh, pricePerKwh);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, listingId: id }));
    return true;
  }
  
  if (pathname === '/energy/match' && req.method === 'POST') {
    matchEnergyOrders();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }
  
  return false;
};
