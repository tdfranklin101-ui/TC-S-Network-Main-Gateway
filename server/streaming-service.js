const MediaResolver = require('./media-resolver');
const cloudStorage = require('./cloud-storage');
const fs = require('fs');
const path = require('path');

class StreamingService {
  constructor(pool) {
    this.pool = pool;
    this.resolver = new MediaResolver(pool);
  }

  async handleStreamRequest(req, res, artifactId) {
    try {
      const item = await this.resolver.resolve(artifactId);

      if (!item.found || !item.streamSource || !item.streamSource.type) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No streamable content found' }));
        return;
      }

      const { streamSource } = item;

      switch (streamSource.type) {
        case 'cloud':
          return this._serveCloud(req, res, streamSource);
        case 'local':
          return this._serveLocal(req, res, streamSource);
        case 'http':
          return this._serveHttp(res, streamSource);
        default:
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No streamable content found' }));
      }
    } catch (err) {
      console.error('[StreamingService] Error handling stream request:', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Streaming error' }));
      }
    }
  }

  async _serveCloud(req, res, source) {
    let cloudKey = source.path;
    if (cloudKey.startsWith('cloud:///')) {
      cloudKey = cloudKey.substring(8);
    } else if (cloudKey.startsWith('cloud://')) {
      cloudKey = cloudKey.substring(8);
    }

    const buffer = await cloudStorage.downloadFile(cloudKey);
    const totalSize = buffer.length;
    const mimeType = source.mimeType || 'application/octet-stream';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(buffer.slice(start, end + 1));
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(buffer);
    }
  }

  _serveLocal(req, res, source) {
    let localUrl = source.path;
    if (localUrl.startsWith('/')) localUrl = localUrl.substring(1);
    const filePath = path.join(__dirname, '..', 'public', localUrl);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No streamable content found' }));
      return;
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const mimeType = source.mimeType || 'application/octet-stream';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': totalSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  }

  _serveHttp(res, source) {
    res.writeHead(302, { Location: source.path });
    res.end();
  }
}

module.exports = StreamingService;
