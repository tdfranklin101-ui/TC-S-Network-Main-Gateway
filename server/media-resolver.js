const path = require('path');
const fs = require('fs');

const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.js': 'application/javascript',
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

const COLLECTION_FILES = [
  'public/models/monazite-collection.json',
  'public/models/gidget-bardot-collection.json'
];

class MediaResolver {
  constructor(pool) {
    this.pool = pool;
    this._collections = null;
  }

  _getMimeType(filePath) {
    if (!filePath) return 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
  }

  _classifyUrl(url) {
    if (!url) return { type: null, path: null };
    if (url.startsWith('cloud://') || url.startsWith('cloud:///')) {
      return { type: 'cloud', path: url };
    }
    if (url.startsWith('//replit-objstore-') || url.startsWith('//repl-objstore-')) {
      return { type: 'cloud', path: 'cloud:/' + url };
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return { type: 'http', path: url };
    }
    if (url.startsWith('/')) {
      return { type: 'local', path: url };
    }
    return { type: 'local', path: '/' + url };
  }

  _resolveLocalFilePath(url) {
    if (!url) return null;
    let relPath = url;
    if (relPath.startsWith('/')) relPath = relPath.substring(1);
    const fullPath = path.join(__dirname, '..', 'public', relPath);
    if (fs.existsSync(fullPath)) return fullPath;
    return null;
  }

  _getFilename(item) {
    const ext = item.fileType ? '.' + item.fileType : path.extname(item.title || 'file');
    const base = (item.title || item.id || 'download').replace(/[^a-zA-Z0-9_-]/g, '_');
    const mimeExt = this._getMimeType(ext !== '.' ? ext : '.bin');
    if (ext && ext !== '.') return base + ext;
    const guessExt = Object.entries(MIME_TYPES).find(([, v]) => v === mimeExt);
    return base + (guessExt ? guessExt[0] : '.bin');
  }

  _loadCollections() {
    if (this._collections) return this._collections;
    this._collections = [];
    for (const relPath of COLLECTION_FILES) {
      const fullPath = path.join(__dirname, '..', relPath);
      try {
        if (fs.existsSync(fullPath)) {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          const items = [
            ...(data.artifacts || []),
            ...(data.bundles || [])
          ];
          this._collections.push(...items);
        }
      } catch (err) {
        console.warn(`[MediaResolver] Failed to load collection ${relPath}:`, err.message);
      }
    }
    return this._collections;
  }

  findInJsonCollections(itemId) {
    const items = this._loadCollections();
    const match = items.find(item => item.id === itemId);
    if (!match) return null;

    let fileUrl = null;
    let localFilePath = null;
    if (match.filePath) {
      let stripped = match.filePath;
      if (stripped.startsWith('public/')) stripped = stripped.substring(7);
      fileUrl = '/' + stripped;
      const fullPath = path.join(__dirname, '..', 'public', stripped);
      if (fs.existsSync(fullPath)) localFilePath = fullPath;
    }

    const fallbackUrl = MUSIC_FALLBACKS[match.title] || null;

    return {
      found: true,
      source: 'json_collections',
      id: match.id,
      title: match.title || '',
      category: match.category || '',
      fileType: match.filePath ? path.extname(match.filePath).replace('.', '') : '',
      priceSolar: match.priceSolar || 0,
      creatorId: match.creatorEmail || null,
      contentBody: match.description || null,
      contentFormat: null,
      active: match.isActive !== false,
      previewFileUrl: fileUrl,
      tradeFileUrl: null,
      masterFileUrl: null,
      deliveryUrl: fallbackUrl || fileUrl,
      streamingUrl: fallbackUrl || fileUrl,
      localFilePath: localFilePath
    };
  }

  async findInMarketItems(itemId) {
    if (!this.pool) return null;
    try {
      const result = await this.pool.query(
        'SELECT * FROM market_items WHERE id = $1 AND status = \'ACTIVE\'',
        [itemId]
      );
      if (result.rows.length === 0) return null;
      return result.rows[0];
    } catch (err) {
      console.warn(`[MediaResolver] market_items query failed:`, err.message);
      return null;
    }
  }

  async resolve(itemId) {
    const notFound = {
      found: false,
      source: null,
      id: itemId,
      title: '',
      category: '',
      fileType: '',
      priceSolar: 0,
      creatorId: null,
      contentBody: null,
      contentFormat: null,
      active: false,
      previewFileUrl: null,
      tradeFileUrl: null,
      masterFileUrl: null,
      deliveryUrl: null,
      streamingUrl: null,
      localFilePath: null,
      streamSource: { type: null, path: null, mimeType: 'application/octet-stream' },
      deliverySource: { type: null, path: null, mimeType: 'application/octet-stream', filename: 'file' }
    };

    let item = null;

    if (this.pool) {
      try {
        const result = await this.pool.query(
          'SELECT * FROM artifacts WHERE id = $1',
          [itemId]
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          const fallbackUrl = MUSIC_FALLBACKS[row.title] || null;
          let localFilePath = null;

          const candidateUrls = [row.preview_file_url, row.trade_file_url, row.delivery_url, row.streaming_url];
          for (const url of candidateUrls) {
            if (url && url.startsWith('/')) {
              const resolved = this._resolveLocalFilePath(url);
              if (resolved) { localFilePath = resolved; break; }
            }
          }

          item = {
            found: true,
            source: 'artifacts',
            id: row.id,
            title: row.title || '',
            category: row.category || '',
            fileType: row.file_type || '',
            priceSolar: parseFloat(row.solar_amount_s) || 0,
            creatorId: row.creator_id || null,
            contentBody: row.content_body || null,
            contentFormat: row.content_format || null,
            active: row.active !== false,
            previewFileUrl: row.preview_file_url || null,
            tradeFileUrl: row.trade_file_url || null,
            masterFileUrl: row.master_file_url || null,
            deliveryUrl: row.delivery_url || fallbackUrl || null,
            streamingUrl: row.streaming_url || fallbackUrl || null,
            localFilePath: localFilePath
          };
        }
      } catch (err) {
        console.warn(`[MediaResolver] artifacts query failed:`, err.message);
      }
    }

    if (!item) {
      const marketRow = await this.findInMarketItems(itemId);
      if (marketRow) {
        item = {
          found: true,
          source: 'market_items',
          id: marketRow.id,
          title: marketRow.title || '',
          category: marketRow.category || '',
          fileType: marketRow.source_type || '',
          priceSolar: parseFloat(marketRow.price_solar) || 0,
          creatorId: marketRow.created_by_user_id || null,
          contentBody: marketRow.description || null,
          contentFormat: null,
          active: marketRow.status === 'ACTIVE',
          previewFileUrl: marketRow.image_url || null,
          tradeFileUrl: marketRow.source_url || null,
          masterFileUrl: null,
          deliveryUrl: marketRow.source_url || null,
          streamingUrl: null,
          localFilePath: marketRow.source_url ? this._resolveLocalFilePath(marketRow.source_url) : null
        };
      }
    }

    if (!item) {
      const jsonItem = this.findInJsonCollections(itemId);
      if (jsonItem) {
        item = jsonItem;
      }
    }

    if (!item) return notFound;

    item.streamSource = this.resolveStreamSource(item);
    item.deliverySource = this.resolveDeliverySource(item);

    return item;
  }

  resolveStreamSource(item) {
    const priorities = [
      item.previewFileUrl,
      item.tradeFileUrl,
      item.deliveryUrl,
      item.localFilePath
    ];

    for (const url of priorities) {
      if (!url) continue;

      if (url.startsWith('/') && !url.startsWith('//')) {
        const localPath = this._resolveLocalFilePath(url);
        if (localPath) {
          return {
            type: 'local',
            path: url,
            mimeType: this._getMimeType(url)
          };
        }
      }

      const classified = this._classifyUrl(url);
      if (classified.type) {
        return {
          type: classified.type,
          path: classified.path,
          mimeType: this._getMimeType(url)
        };
      }
    }

    return { type: null, path: null, mimeType: 'application/octet-stream' };
  }

  resolveDeliverySource(item) {
    const priorities = [
      item.tradeFileUrl,
      item.masterFileUrl,
      item.deliveryUrl,
      item.localFilePath
    ];

    const filename = this._getFilename(item);

    for (const url of priorities) {
      if (!url) continue;

      if (url.startsWith('/') && !url.startsWith('//')) {
        const localPath = this._resolveLocalFilePath(url);
        if (localPath) {
          return {
            type: 'local',
            path: url,
            mimeType: this._getMimeType(url),
            filename
          };
        }
      }

      const classified = this._classifyUrl(url);
      if (classified.type) {
        return {
          type: classified.type,
          path: classified.path,
          mimeType: this._getMimeType(url),
          filename
        };
      }
    }

    return { type: null, path: null, mimeType: 'application/octet-stream', filename };
  }
}

module.exports = MediaResolver;
