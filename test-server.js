const express = require('express');
const path = require('path');
const app = express();

// Serve static files from deploy_v1_multimodal
app.use('/', express.static(path.join(__dirname, 'deploy_v1_multimodal')));

app.listen(3001, () => {
  console.log('Test server running on http://localhost:3001');
  console.log('Music buttons should be visible at line 245+');
});