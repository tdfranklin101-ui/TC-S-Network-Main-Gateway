/**
 * Simple Test Server for The Current-See
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`View the Solar Generator page at: http://localhost:${PORT}/solar-generator.html`);
});