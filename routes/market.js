const { MarketCategories } = require('../lib/categories');
const { artifacts } = require('../lib/artifacts');

module.exports = function(req, res, pathname) {
  if (pathname === '/market/categories') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MarketCategories));
    return true;
  }
  
  const artifactMatch = pathname.match(/^\/market\/artifacts\/(.+)$/);
  if (artifactMatch) {
    const category = artifactMatch[1];
    const filtered = artifacts.filter(a => a.category === category);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered));
    return true;
  }
  
  return false;
};
