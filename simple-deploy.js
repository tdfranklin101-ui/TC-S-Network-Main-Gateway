const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK' }));
app.get('/', (req, res) => {
  if (!req.headers['user-agent']) return res.send('OK');
  res.send(`
    <html>
      <head><title>The Current-See</title></head>
      <body>
        <h1>The Current-See</h1>
        <p>Solar-backed universal basic income platform</p>
        <p>Server running on port ${PORT}</p>
        <p><a href="/health">Health Check</a></p>
      </body>
    </html>
  `);
});

// Static files
app.use(express.static('public'));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});