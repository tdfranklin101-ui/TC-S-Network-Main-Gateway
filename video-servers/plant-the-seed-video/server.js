const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/video.mp4', (req, res) => {
  const videoPath = path.join(__dirname, 'plant-the-seed.mp4');
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400'
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400'
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Plant the Seed video server running on port ${PORT}`);
});
