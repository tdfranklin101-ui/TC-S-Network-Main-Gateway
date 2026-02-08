const { Client } = require('@replit/object-storage');
const fs = require('fs');

let client;
try {
  client = new Client();
} catch (err) {
  console.warn('[CloudStorage] Object storage unavailable:', err.message);
  client = null;
}

const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || '.private';

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

  async downloadFile(key) {
    if (!client) throw new Error('Object storage is not available');
    const result = await client.downloadAsBytes(key);
    if (!result.ok) throw new Error(`Download failed for key: ${key}`);
    const value = result.value;
    if (Array.isArray(value) && value.length > 0 && value[0].length > 0) return value[0];
    if (Buffer.isBuffer(value) && value.length > 0) return value;
    throw new Error(`Empty or missing file for key: ${key}`);
  }

  async fileExists(key) {
    if (!client) return false;
    try {
      const result = await client.downloadAsBytes(key);
      if (!result.ok) return false;
      const value = result.value;
      if (Array.isArray(value) && value.length > 0 && value[0].length > 0) return true;
      if (Buffer.isBuffer(value) && value.length > 0) return true;
      return false;
    } catch {
      return false;
    }
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
