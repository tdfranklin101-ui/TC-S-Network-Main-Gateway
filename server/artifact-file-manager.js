const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PreviewGenerator = require('./preview-generator');
const cloudStorage = require('./cloud-storage');

class ArtifactFileManager {
  constructor(options = {}) {
    this.masterStoragePath = options.masterStoragePath || path.join(__dirname, '../storage/master');
    this.previewStoragePath = options.previewStoragePath || path.join(__dirname, '../public/previews');
    this.tradeStoragePath = options.tradeStoragePath || path.join(__dirname, '../storage/trade');
    this.tempPath = options.tempPath || path.join(__dirname, '../temp');
    
    this.previewGenerator = new PreviewGenerator({
      publicDir: this.previewStoragePath,
      tempDir: this.tempPath
    });
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.masterStoragePath, this.previewStoragePath, this.tradeStoragePath, this.tempPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async processUpload(fileBuffer, fileInfo, metadata = {}) {
    const artifactId = crypto.randomUUID();
    const fileExtension = path.extname(fileInfo.originalname) || '.bin';
    
    try {
      console.log(`🔄 Processing upload: ${metadata.title || fileInfo.originalname} (${artifactId})`);
      
      const masterResult = await this.storeMasterFile(fileBuffer, artifactId, fileExtension, fileInfo);
      const previewResult = await this.generatePreviewFile(fileBuffer, artifactId, fileInfo, metadata);
      const tradeResult = await this.prepareTradeFile(fileBuffer, artifactId, fileExtension, fileInfo, metadata);
      const fileMetadata = this.calculateFileMetadata(fileBuffer, fileInfo, previewResult);
      
      const result = {
        success: true,
        artifactId,
        masterFile: masterResult,
        previewFile: previewResult,
        tradeFile: tradeResult,
        metadata: fileMetadata,
        processingStatus: 'completed'
      };
      
      console.log(`✅ Upload processed: ${artifactId} - Master: ${masterResult.size}B, Preview: ${previewResult.previewSize}B, Trade: ${tradeResult.size}B`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Upload processing failed for ${artifactId}:`, error);
      await this.cleanup(artifactId);
      
      return {
        success: false,
        error: error.message,
        artifactId,
        processingStatus: 'failed'
      };
    }
  }

  async storeMasterFile(fileBuffer, artifactId, fileExtension, fileInfo) {
    if (cloudStorage.isAvailable()) {
      try {
        const result = await cloudStorage.uploadMasterFile(artifactId, fileExtension, fileBuffer);
        return {
          url: result.url,
          cloudKey: result.key,
          size: result.size,
          storageProvider: 'cloud',
          originalName: fileInfo.originalname,
          mimeType: fileInfo.mimetype,
          secureAccess: true
        };
      } catch (err) {
        console.warn(`[ArtifactFileManager] Cloud upload failed for master ${artifactId}, falling back to local:`, err.message);
      }
    }

    const masterFileName = `${artifactId}_master${fileExtension}`;
    const masterFilePath = path.join(this.masterStoragePath, masterFileName);
    
    fs.writeFileSync(masterFilePath, fileBuffer);
    
    const secureUrl = this.generateSecureUrl('master', artifactId, 86400);
    
    return {
      url: secureUrl.url,
      internalPath: masterFilePath,
      size: fileBuffer.length,
      storageProvider: 'local',
      originalName: fileInfo.originalname,
      mimeType: fileInfo.mimetype,
      secureAccess: true
    };
  }

  async generatePreviewFile(fileBuffer, artifactId, fileInfo, metadata) {
    const previewResult = await this.previewGenerator.generatePreview(
      fileBuffer, 
      fileInfo.mimetype, 
      {
        ...metadata,
        artifactId,
        originalName: fileInfo.originalname
      }
    );
    
    if (!previewResult.success) {
      throw new Error(`Preview generation failed: ${previewResult.error}`);
    }

    if (cloudStorage.isAvailable() && previewResult.previewPath) {
      try {
        const previewFilePath = path.isAbsolute(previewResult.previewPath)
          ? previewResult.previewPath
          : path.join(this.previewStoragePath, previewResult.previewPath);
        
        if (fs.existsSync(previewFilePath)) {
          const previewBuffer = fs.readFileSync(previewFilePath);
          const previewFilename = path.basename(previewFilePath);
          const cloudResult = await cloudStorage.uploadPreviewFile(artifactId, previewFilename, previewBuffer);
          previewResult.cloudKey = cloudResult.key;
          previewResult.storageProvider = 'cloud';
        }
      } catch (err) {
        console.warn(`[ArtifactFileManager] Cloud upload failed for preview ${artifactId}:`, err.message);
      }
    }
    
    return previewResult;
  }

  async prepareTradeFile(fileBuffer, artifactId, fileExtension, fileInfo, metadata) {
    let tradeBuffer = fileBuffer;
    
    if (fileInfo.mimetype.startsWith('image/') && fileInfo.mimetype !== 'image/svg+xml') {
      tradeBuffer = fileBuffer;
    } else if (fileInfo.mimetype.startsWith('audio/')) {
      tradeBuffer = fileBuffer;
    } else if (fileInfo.mimetype.startsWith('video/')) {
      tradeBuffer = fileBuffer;
    }

    if (cloudStorage.isAvailable()) {
      try {
        const result = await cloudStorage.uploadTradeFile(artifactId, fileExtension, tradeBuffer);
        return {
          url: result.url,
          cloudKey: result.key,
          size: result.size,
          storageProvider: 'cloud',
          mimeType: fileInfo.mimetype,
          originalName: fileInfo.originalname,
          secureAccess: true
        };
      } catch (err) {
        console.warn(`[ArtifactFileManager] Cloud upload failed for trade ${artifactId}, falling back to local:`, err.message);
      }
    }

    const tradeFileName = `${artifactId}_trade${fileExtension}`;
    const tradeFilePath = path.join(this.tradeStoragePath, tradeFileName);
    
    fs.writeFileSync(tradeFilePath, tradeBuffer);
    
    const secureUrl = this.generateSecureUrl('trade', artifactId, 7 * 86400);
    
    return {
      url: secureUrl.url,
      internalPath: tradeFilePath,
      size: tradeBuffer.length,
      storageProvider: 'local',
      mimeType: fileInfo.mimetype,
      originalName: fileInfo.originalname,
      secureAccess: true
    };
  }

  calculateFileMetadata(fileBuffer, fileInfo, previewResult) {
    return {
      originalSize: fileBuffer.length,
      originalName: fileInfo.originalname,
      mimeType: fileInfo.mimetype,
      previewType: previewResult.previewType,
      previewSize: previewResult.previewSize || 0,
      previewDuration: previewResult.previewDuration,
      uploadTimestamp: new Date().toISOString(),
      checksum: crypto.createHash('sha256').update(fileBuffer).digest('hex')
    };
  }

  generateSecureUrl(fileType, artifactId, expiresIn = 3600) {
    const timestamp = Math.floor(Date.now() / 1000);
    const expires = timestamp + expiresIn;
    
    const payload = `${fileType}:${artifactId}:${expires}`;
    const secret = process.env.FILE_ACCESS_SECRET || 'default-secret-change-in-production';
    const token = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    
    return {
      url: `/api/files/secure/${fileType}/${artifactId}?token=${token}&expires=${expires}`,
      expires: new Date(expires * 1000),
      expiresIn
    };
  }

  verifySecureUrl(fileType, artifactId, token, expires) {
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (currentTime > expires) {
      return { valid: false, reason: 'Token expired' };
    }
    
    const payload = `${fileType}:${artifactId}:${expires}`;
    const secret = process.env.FILE_ACCESS_SECRET || 'default-secret-change-in-production';
    const expectedToken = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    
    if (token !== expectedToken) {
      return { valid: false, reason: 'Invalid token' };
    }
    
    return { valid: true };
  }

  getFilePath(fileType, artifactId, fileExtension = '') {
    if (!fileExtension) {
      const baseDir = this.getBaseDirectory(fileType);
      const files = fs.readdirSync(baseDir).filter(f => f.startsWith(`${artifactId}_${fileType}`));
      if (files.length > 0) {
        return path.join(baseDir, files[0]);
      }
      fileExtension = '.bin';
    }
    
    const fileName = `${artifactId}_${fileType}${fileExtension}`;
    const baseDir = this.getBaseDirectory(fileType);
    return path.join(baseDir, fileName);
  }
  
  getBaseDirectory(fileType) {
    switch (fileType) {
      case 'master':
        return this.masterStoragePath;
      case 'trade':
        return this.tradeStoragePath;
      case 'preview':
        return this.previewStoragePath;
      default:
        throw new Error(`Invalid file type: ${fileType}`);
    }
  }

  fileExists(fileType, artifactId, fileExtension = '') {
    try {
      const filePath = this.getFilePath(fileType, artifactId, fileExtension);
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  async getCloudFile(fileType, artifactId) {
    if (!cloudStorage.isAvailable()) return null;
    const extensions = ['.png', '.jpg', '.jpeg', '.mp3', '.wav', '.mp4', '.txt', '.json', '.bin'];
    for (const ext of extensions) {
      const key = fileType === 'preview' 
        ? `public/previews/${artifactId}_preview${ext}`
        : `${process.env.PRIVATE_OBJECT_DIR || '.private'}/${fileType}/${artifactId}_${fileType}${ext}`;
      try {
        const buffer = await cloudStorage.downloadFile(key);
        if (buffer) return { buffer, key };
      } catch { continue; }
    }
    return null;
  }

  async cleanup(artifactId) {
    const directories = [this.masterStoragePath, this.previewStoragePath, this.tradeStoragePath];
    
    for (const dir of directories) {
      try {
        const files = fs.readdirSync(dir).filter(file => file.startsWith(artifactId));
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file));
        }
      } catch (error) {
        console.warn(`Cleanup warning for ${dir}:`, error.message);
      }
    }

    if (cloudStorage.isAvailable()) {
      const cloudKeys = [
        `${process.env.PRIVATE_OBJECT_DIR || '.private'}/master/${artifactId}_master`,
        `${process.env.PRIVATE_OBJECT_DIR || '.private'}/trade/${artifactId}_trade`,
        `public/previews/${artifactId}_preview`
      ];
      const extensions = ['.png', '.jpg', '.jpeg', '.mp3', '.wav', '.mp4', '.txt', '.json', '.bin'];
      for (const baseKey of cloudKeys) {
        for (const ext of extensions) {
          try {
            await cloudStorage.deleteFile(baseKey + ext);
          } catch {
            // ignore missing cloud files
          }
        }
      }
    }
    
    this.previewGenerator.cleanup(artifactId);
  }

  getStorageStats() {
    const getDirectorySize = (dirPath) => {
      if (!fs.existsSync(dirPath)) return { files: 0, size: 0 };
      
      const files = fs.readdirSync(dirPath);
      let totalSize = 0;
      
      for (const file of files) {
        try {
          const stats = fs.statSync(path.join(dirPath, file));
          totalSize += stats.size;
        } catch (error) {
          // Skip files that can't be read
        }
      }
      
      return { files: files.length, size: totalSize };
    };
    
    return {
      master: getDirectorySize(this.masterStoragePath),
      preview: getDirectorySize(this.previewStoragePath),
      trade: getDirectorySize(this.tradeStoragePath),
      cloudAvailable: cloudStorage.isAvailable(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ArtifactFileManager;
