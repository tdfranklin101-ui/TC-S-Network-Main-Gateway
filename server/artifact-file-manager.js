const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PreviewGenerator = require('./preview-generator');

/**
 * Enhanced Three-Copy File Management System
 * Handles Master → Preview → Trade file workflow
 */
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

  /**
   * Process uploaded file through three-copy workflow
   * @param {Buffer} fileBuffer - Original file buffer
   * @param {Object} fileInfo - File information (name, mime, size)
   * @param {Object} metadata - Additional metadata (title, description, category)
   * @returns {Object} Processing result with all three file copies
   */
  async processUpload(fileBuffer, fileInfo, metadata = {}) {
    const artifactId = crypto.randomUUID();
    const fileExtension = path.extname(fileInfo.originalname) || '.bin';
    
    try {
      console.log(`🔄 Processing upload: ${metadata.title || fileInfo.originalname} (${artifactId})`);
      
      // Step 1: Store Master File (original, secure)
      const masterResult = await this.storeMasterFile(fileBuffer, artifactId, fileExtension, fileInfo);
      
      // Step 2: Generate Preview File (optimized for viewing)
      const previewResult = await this.generatePreviewFile(fileBuffer, artifactId, fileInfo, metadata);
      
      // Step 3: Prepare Trade File (deliverable to purchasers)
      const tradeResult = await this.prepareTradeFile(fileBuffer, artifactId, fileExtension, fileInfo, metadata);
      
      // Step 4: Calculate file metadata
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
      
      // Cleanup any partial files
      await this.cleanup(artifactId);
      
      return {
        success: false,
        error: error.message,
        artifactId,
        processingStatus: 'failed'
      };
    }
  }

  /**
   * Store master file in secure private storage
   */
  async storeMasterFile(fileBuffer, artifactId, fileExtension, fileInfo) {
    const masterFileName = `${artifactId}_master${fileExtension}`;
    const masterFilePath = path.join(this.masterStoragePath, masterFileName);
    
    fs.writeFileSync(masterFilePath, fileBuffer);
    
    // SECURITY: Never expose direct storage paths!
    // Always use secure URL generation
    const secureUrl = this.generateSecureUrl('master', artifactId, 86400); // 24 hour expiry for master files
    
    return {
      url: secureUrl.url, // Secure tokenized URL
      internalPath: masterFilePath, // Internal use only - never expose!
      size: fileBuffer.length,
      originalName: fileInfo.originalname,
      mimeType: fileInfo.mimetype,
      secureAccess: true
    };
  }

  /**
   * Generate preview file using PreviewGenerator
   */
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
    
    return previewResult;
  }

  /**
   * Prepare trade file (deliverable copy)
   * For most files, this is the same as master, but could be optimized
   */
  async prepareTradeFile(fileBuffer, artifactId, fileExtension, fileInfo, metadata) {
    const tradeFileName = `${artifactId}_trade${fileExtension}`;
    const tradeFilePath = path.join(this.tradeStoragePath, tradeFileName);
    
    // For now, trade file is same as master
    // In advanced implementation, could apply compression, watermarking, etc.
    let tradeBuffer = fileBuffer;
    
    // Apply trade-specific processing based on file type
    if (fileInfo.mimetype.startsWith('image/') && fileInfo.mimetype !== 'image/svg+xml') {
      // Could add watermarking or compression for images
      tradeBuffer = fileBuffer; // For now, keep original
    } else if (fileInfo.mimetype.startsWith('audio/')) {
      // Could apply audio processing (normalization, compression)
      tradeBuffer = fileBuffer; // For now, keep original
    } else if (fileInfo.mimetype.startsWith('video/')) {
      // Could apply video processing (compression, format optimization)
      tradeBuffer = fileBuffer; // For now, keep original
    }
    
    fs.writeFileSync(tradeFilePath, tradeBuffer);
    
    // SECURITY: Never expose direct storage paths!
    // Trade files get longer expiry since they're purchased content
    const secureUrl = this.generateSecureUrl('trade', artifactId, 7 * 86400); // 7 days for purchased content
    
    return {
      url: secureUrl.url, // Secure tokenized URL  
      internalPath: tradeFilePath, // Internal use only - never expose!
      size: tradeBuffer.length,
      mimeType: fileInfo.mimetype,
      originalName: fileInfo.originalname,
      secureAccess: true
    };
  }

  /**
   * Calculate comprehensive file metadata
   */
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

  /**
   * Generate secure temporary URL for file access
   * @param {string} fileType - 'master', 'preview', or 'trade'
   * @param {string} artifactId - Artifact identifier
   * @param {number} expiresIn - Expiration in seconds (default 1 hour)
   */
  generateSecureUrl(fileType, artifactId, expiresIn = 3600) {
    const timestamp = Math.floor(Date.now() / 1000);
    const expires = timestamp + expiresIn;
    
    // Create secure token
    const payload = `${fileType}:${artifactId}:${expires}`;
    const secret = process.env.FILE_ACCESS_SECRET || 'default-secret-change-in-production';
    const token = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    
    return {
      url: `/api/files/secure/${fileType}/${artifactId}?token=${token}&expires=${expires}`,
      expires: new Date(expires * 1000),
      expiresIn
    };
  }

  /**
   * Verify secure URL token
   */
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

  /**
   * Get internal file path for secure access (INTERNAL USE ONLY)
   * WARNING: These paths must NEVER be exposed to clients!
   */
  getFilePath(fileType, artifactId, fileExtension = '') {
    // Try to find file with any extension if none provided
    if (!fileExtension) {
      const baseDir = this.getBaseDirectory(fileType);
      const files = fs.readdirSync(baseDir).filter(f => f.startsWith(`${artifactId}_${fileType}`));
      if (files.length > 0) {
        return path.join(baseDir, files[0]);
      }
      // Fallback to generic extension
      fileExtension = '.bin';
    }
    
    const fileName = `${artifactId}_${fileType}${fileExtension}`;
    const baseDir = this.getBaseDirectory(fileType);
    return path.join(baseDir, fileName);
  }
  
  /**
   * Get base directory for file type
   */
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

  /**
   * Check if file exists
   */
  fileExists(fileType, artifactId, fileExtension = '') {
    try {
      const filePath = this.getFilePath(fileType, artifactId, fileExtension);
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up all files for an artifact
   */
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
    
    // Also cleanup preview generator files
    this.previewGenerator.cleanup(artifactId);
  }

  /**
   * Get storage statistics
   */
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
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ArtifactFileManager;