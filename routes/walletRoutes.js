const router = require('express').Router();
const { walletBalances } = require('../agents');

router.get('/:walletAddress/balance', (req, res) => {
  const bal = walletBalances[req.params.walletAddress];
  if (!bal) return res.json({ balanceSolar: 0 });
  res.json(bal);
});

module.exports = router;
