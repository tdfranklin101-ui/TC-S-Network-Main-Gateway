const { kidSolarRespond } = require('../lib/kidSolar');

module.exports = async function(req, res, pathname, body) {
  if (pathname === '/kid/query' && req.method === 'POST') {
    const { walletId, text } = body;
    const reply = await kidSolarRespond(walletId, text);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ reply }));
    return true;
  }
  
  return false;
};
