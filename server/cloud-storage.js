const { Client } = require('@replit/object-storage');
const fs = require('fs');

let client;
try {
  client = new Client();
} catch (err) {
  console.warn('[CloudStorage] Object storage unavailable:', err.message);
  client = null;
}

let PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';
if (PRIVATE_DIR.startsWith('/')) PRIVATE_DIR = PRIVATE_DIR.substring(1);
const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
if (bucketId && PRIVATE_DIR.startsWith(bucketId + '/')) {
  PRIVATE_DIR = PRIVATE_DIR.substring(bucketId.length + 1);
}
if (PRIVATE_DIR.startsWith('replit-objstore-') || PRIVATE_DIR.startsWith('repl-objstore-')) {
  const slashIdx = PRIVATE_DIR.indexOf('/');
  if (slashIdx > 0) PRIVATE_DIR = PRIVATE_DIR.substring(slashIdx + 1);
}

class ObjectStorageService {
  isAvailable() {
    return client !== null;
  }

  async uploadFromBuffer(key, buffer) {
    if (!client) throw new Error('Object storage is not available');
    await client.uploadFromBytes(key, buffer);
    const url = await this._getUrl(key);
    return { key, url, size: buffer.length };
  }

  async uploadMasterFile(artifactId, fileExtension, buffer) {
    const key = `${PRIVATE_DIR}/master/${artifactId}_master${fileExtension}`;
    return this.uploadFromBuffer(key, buffer);
  }

  async uploadTradeFile(artifactId, fileExtension, buffer) {
    const key = `${PRIVATE_DIR}/trade/${artifactId}_trade${fileExtension}`;
    return this.uploadFromBuffer(key, buffer);
  }

  async uploadPreviewFile(artifactId, filename, buffer) {
    const key = `public/previews/${filename}`;
    return this.uploadFromBuffer(key, buffer);
  }

  _extractValue(result) {
    if (!result.ok) return null;
    const value = result.value;
    if (Array.isArray(value) && value.length > 0 && value[0].length > 0) return value[0];
    if (Buffer.isBuffer(value) && value.length > 0) return value;
    return null;
  }

  _buildKeyVariants(key) {
    const variants = [];
    let base = key;
    if (base.startsWith('/')) base = base.substring(1);
    const bucketPrefix = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    let stripped = base;
    if (bucketPrefix && stripped.startsWith(bucketPrefix + '/')) {
      stripped = stripped.substring(bucketPrefix.length + 1);
    }
    if (stripped.startsWith('replit-objstore-') || stripped.startsWith('repl-objstore-')) {
      const slashIdx = stripped.indexOf('/');
      if (slashIdx > 0) stripped = stripped.substring(slashIdx + 1);
    }
    if (stripped) variants.push(stripped);
    if (base && !variants.includes(base)) variants.push(base);
    const withSlash = '/' + base;
    if (!variants.includes(withSlash)) variants.push(withSlash);
    return variants;
  }

  async downloadFile(key) {
    if (!client) throw new Error('Object storage is not available');
    const variants = this._buildKeyVariants(key);
    for (const variant of variants) {
      try {
        const result = await client.downloadAsBytes(variant);
        const value = this._extractValue(result);
        if (value) return value;
      } catch {}
    }
    throw new Error(`Download failed for key: ${key} (tried ${variants.length} variants)`);
  }

  async fileExists(key) {
    if (!client) return false;
    const variants = this._buildKeyVariants(key);
    for (const variant of variants) {
      try {
        const result = await client.downloadAsBytes(variant);
        if (this._extractValue(result)) return true;
      } catch {}
    }
    return false;
  }

  async deleteFile(key) {
    if (!client) throw new Error('Object storage is not available');
    await client.delete(key);
  }

  getPublicUrl(key) {
    return `/${key}`;
  }

  async getSignedUrl(key, expiresIn) {
    if (!client) return `/${key}`;
    try {
      const url = await client.getSignedDownloadUrl(key);
      return url;
    } catch {
      return `/${key}`;
    }
  }

  async migrateLocalFile(localPath, storageKey) {
    if (!client) throw new Error('Object storage is not available');
    const buffer = fs.readFileSync(localPath);
    return this.uploadFromBuffer(storageKey, buffer);
  }

  async _getUrl(key) {
    if (key.startsWith('public/')) {
      return `/${key}`;
    }
    try {
      return await client.getSignedDownloadUrl(key);
    } catch {
      return `/${key}`;
    }
  }
}

module.exports = new ObjectStorageService();
