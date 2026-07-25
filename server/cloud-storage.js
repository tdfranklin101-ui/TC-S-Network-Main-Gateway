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
    // Objects have historically been stored under two key shapes: verbatim as
    // uploaded (often "/{bucket-id}/.private/..." because PRIVATE_OBJECT_DIR
    // includes the bucket prefix) and fully normalized (".private/...").
    // Uploads never normalized, so the verbatim form is tried FIRST — reads
    // that only try the normalized form fail for every object uploaded with a
    // prefixed key. Fall back through the progressively normalized candidates
    // so both populations stay readable.
    const candidates = [key];
    let k = key;
    if (!k.startsWith('/')) {
      // Callers sometimes strip the leading slash (e.g. `cloud:///` handling);
      // stored bucket-prefixed names keep it, so try the slashed form too.
      const slashed = '/' + k;
      if (!candidates.includes(slashed)) candidates.push(slashed);
    }
    if (k.startsWith('/')) {
      k = k.substring(1);
      if (!candidates.includes(k)) candidates.push(k);
    }
    const bucketPrefix = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (bucketPrefix && k.startsWith(bucketPrefix + '/')) {
      k = k.substring(bucketPrefix.length + 1);
      if (!candidates.includes(k)) candidates.push(k);
    }
    if (k.startsWith('replit-objstore-')) {
      const slashIdx = k.indexOf('/');
      if (slashIdx > 0) {
        k = k.substring(slashIdx + 1);
        if (!candidates.includes(k)) candidates.push(k);
      }
    }
    for (const candidate of candidates) {
      let result;
      try {
        result = await client.downloadAsBytes(candidate);
      } catch {
        continue;
      }
      if (!result.ok) continue;
      const value = result.value;
      if (Array.isArray(value) && value.length > 0 && value[0].length > 0) return value[0];
      if (Buffer.isBuffer(value) && value.length > 0) return value;
    }
    throw new Error(`Download failed for key: ${key} (tried ${candidates.length} key forms)`);
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
