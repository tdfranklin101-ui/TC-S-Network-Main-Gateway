const router = require('express').Router();
const controller = require('../agents/agentController');

router.post('/register-personal', controller.registerPersonal);
router.post('/register-domain', controller.registerDomain);
router.get('/:agentId', controller.getAgent);
router.post('/:agentId/settings', controller.updateSettings);
router.post('/:agentId/actions', controller.performAction);

module.exports = router;
