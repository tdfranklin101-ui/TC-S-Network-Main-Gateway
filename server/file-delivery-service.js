const MediaResolver = require('./media-resolver');
const cloudStorage = require('./cloud-storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf'
};

const MUSIC_FALLBACKS = {
  "'Ternal Flame": "https://storage.aisongmaker.io/audio/4a839c86-40d9-4272-989b-7a512184ddb6.mp3",
  "David Boyeez Hair": "https://storage.aisongmaker.io/audio/9b2b12e4-8626-41e4-b9e4-c7a563e40f97.mp3",
  "Starlight Forever": "https://storage.aisongmaker.io/audio/c51b1f15-eff7-41fb-b778-b1b9d914ce3a.mp3",
  "Snowmancer One": "/music/snowmancer-one.mp3",
  "No One Left (to care)": "/media/gidget-bardot-no-one-left-v3.mp3",
  "In The Seam (Quanta Masque)": "/media/in-the-seam-quanta-masque.mp3",
  "Omen on the Hudson (Quanta Masque)": "/media/omen-on-the-hudson.mp3",
  "Break on the Bright Side - Batrhyme": "/media/batrhyme-break-on-the-bright-side.mp3",
  "Psychedelic Solar Punk Party Party Party": "/media/batrhyme-psychedelic-solar-punk-party.mp3"
};

class FileDeliveryService {
  constructor(pool) {
    this.pool = pool;
    this.resolver = new MediaResolver(pool);
  }

  _getMimeType(filePath) {
    if (!filePath) return 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
  }

  _resolveLocalFilePath(url) {
    if (!url) return null;
    let relPath = url;
    if (relPath.startsWith('/')) relPath = relPath.substring(1);

    const publicPath = path.join(__dirname, '..', 'public', relPath);
    if (fs.existsSync(publicPath)) return publicPath;

    const rootPath = path.join(__dirname, '..', relPath);
    if (fs.existsSync(rootPath)) return rootPath;

    return null;
  }

  async handleTokenDownload(req, res, token) {
    try {
      const result = await this.pool.query(
        'SELECT id, token, artifact_id, user_id, expires_at, download_count, max_downloads, is_revoked FROM download_tokens WHERE token = $1 AND is_revoked = false',
        [token]
      );

      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or revoked download token' }));
      }

      const tokenRow = result.rows[0];

      if (new Date(tokenRow.expires_at) < new Date()) {
        res.writeHead(410, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Download token has expired' }));
      }

      if (tokenRow.download_count >= tokenRow.max_downloads) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Maximum download limit reached' }));
      }

      const item = await this.resolver.resolve(tokenRow.artifact_id);

      if (!item || !item.found) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Artifact not found' }));
      }

      const served = await this._serveFile(req, res, item);

      if (served) {
        await this.pool.query(
          'UPDATE download_tokens SET download_count = download_count + 1 WHERE id = $1',
          [tokenRow.id]
        );
      }
    } catch (err) {
      console.error('[FileDeliveryService] handleTokenDownload error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error during file delivery' }));
      }
    }
  }

  async handleDirectDelivery(req, res, artifactId, userId) {
    try {
      const copyResult = await this.pool.query(
        'SELECT id FROM artifact_copies WHERE artifact_id = $1 AND user_id = $2',
        [artifactId, userId]
      );

      if (copyResult.rows.length === 0) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'You do not own a copy of this artifact' }));
      }

      const item = await this.resolver.resolve(artifactId);

      if (!item || !item.found) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Artifact not found' }));
      }

      await this._serveFile(req, res, item);
    } catch (err) {
      console.error('[FileDeliveryService] handleDirectDelivery error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error during file delivery' }));
      }
    }
  }

  async createDownloadToken(artifactId, userId, expiresInDays = 7, maxDownloads = 10) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    await this.pool.query(
      'INSERT INTO download_tokens (token, artifact_id, user_id, expires_at, access_type, max_downloads) VALUES ($1, $2, $3, $4, $5, $6)',
      [token, artifactId, userId, expiresAt, 'trade_file', maxDownloads]
    );
    return { token, url: `/api/delivery/${token}`, expiresAt };
  }

  async _serveFile(req, res, item) {
    const safeTitle = (item.title || 'download').replace(/[^a-zA-Z0-9_\-\. ]/g, '_');

    if (item.contentBody && !item.tradeFileUrl && !item.masterFileUrl && !item.deliveryUrl && !item.previewFileUrl) {
      const contentType = item.contentFormat === 'markdown' ? 'text/markdown' : 'text/plain';
      const ext = item.contentFormat === 'markdown' ? 'md' : 'txt';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeTitle}.${ext}"`,
      });
      res.end(item.contentBody);
      return true;
    }

    const deliverySource = item.deliverySource;

    if (deliverySource && deliverySource.type) {
      const served = await this._serveFromSource(req, res, deliverySource, safeTitle, item);
      if (served) return true;
    }

    const fallbackUrl = MUSIC_FALLBACKS[item.title];
    if (fallbackUrl) {
      const served = await this._serveFallback(req, res, fallbackUrl, safeTitle);
      if (served) return true;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No deliverable file found for this artifact' }));
    return false;
  }

  async _serveFromSource(req, res, source, safeTitle, item) {
    try {
      if (source.type === 'cloud') {
        const cloudKey = source.path.replace(/^cloud:\/\/\/?/, '');
        const buffer = await cloudStorage.downloadFile(cloudKey);
        const mimeType = source.mimeType || 'application/octet-stream';
        const filename = source.filename || safeTitle;
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Length': buffer.length,
          'Content-Disposition': `attachment; filename="${filename}"`,
        });
        res.end(buffer);
        return true;
      }

      if (source.type === 'local') {
        const localPath = this._resolveLocalFilePath(source.path);
        if (localPath) {
          const stat = fs.statSync(localPath);
          const mimeType = source.mimeType || this._getMimeType(localPath);
          const filename = source.filename || safeTitle;
          res.writeHead(200, {
            'Content-Type': mimeType,
            'Content-Length': stat.size,
            'Content-Disposition': `attachment; filename="${filename}"`,
          });
          const stream = fs.createReadStream(localPath);
          stream.pipe(res);
          return true;
        }
        return false;
      }

      if (source.type === 'http') {
        res.writeHead(302, { 'Location': source.path });
        res.end();
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[FileDeliveryService] _serveFromSource failed:', err.message);
      return false;
    }
  }

  async _serveFallback(req, res, fallbackUrl, safeTitle) {
    try {
      if (fallbackUrl.startsWith('http://') || fallbackUrl.startsWith('https://')) {
        res.writeHead(302, { 'Location': fallbackUrl });
        res.end();
        return true;
      }

      const localPath = this._resolveLocalFilePath(fallbackUrl);
      if (localPath) {
        const stat = fs.statSync(localPath);
        const mimeType = this._getMimeType(localPath);
        const ext = path.extname(localPath);
        const filename = safeTitle + (ext || '.mp3');
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Length': stat.size,
          'Content-Disposition': `attachment; filename="${filename}"`,
        });
        const stream = fs.createReadStream(localPath);
        stream.pipe(res);
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[FileDeliveryService] _serveFallback failed:', err.message);
      return false;
    }
  }
}

module.exports = FileDeliveryService;
