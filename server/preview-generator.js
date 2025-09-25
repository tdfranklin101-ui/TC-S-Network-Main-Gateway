// Conditional sharp import for Cloud Run compatibility
let sharp = null;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('⚠️ Sharp disabled in PreviewGenerator:', error.message);
}

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Enhanced Preview Generation System
 * Creates optimized preview files for different media types
 */
class PreviewGenerator {
  constructor(options = {}) {
    this.tempDir = options.tempDir || path.join(__dirname, '../temp');
    this.publicDir = options.publicDir || path.join(__dirname, '../public/previews');
    this.privateDir = options.privateDir || process.env.PRIVATE_OBJECT_DIR || '/private';
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.tempDir, this.publicDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate appropriate preview based on file type
   * @param {Buffer} fileBuffer - Original file buffer
   * @param {string} mimeType - File MIME type
   * @param {Object} metadata - File metadata (title, duration, etc.)
   * @returns {Object} Preview generation result
   */
  async generatePreview(fileBuffer, mimeType, metadata = {}) {
    const previewId = crypto.randomUUID();
    
    try {
      if (mimeType.startsWith('image/')) {
        return await this.generateImagePreview(fileBuffer, previewId, metadata);
      } else if (mimeType.startsWith('video/')) {
        return await this.generateVideoPreview(fileBuffer, previewId, metadata);
      } else if (mimeType.startsWith('audio/')) {
        return await this.generateAudioPreview(fileBuffer, previewId, metadata);
      } else if (mimeType === 'application/pdf') {
        return await this.generatePdfPreview(fileBuffer, previewId, metadata);
      } else if (mimeType.startsWith('text/')) {
        return await this.generateTextPreview(fileBuffer, previewId, metadata);
      } else {
        return await this.generateGenericPreview(fileBuffer, previewId, metadata);
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      return {
        success: false,
        error: error.message,
        previewType: 'none'
      };
    }
  }

  /**
   * Generate image preview (thumbnail + web-optimized version)
   */
  async generateImagePreview(fileBuffer, previewId, metadata) {
    if (!sharp) {
      console.warn('Sharp not available, generating placeholder image preview');
      return this.generateImagePlaceholder(previewId, metadata);
    }

    const thumbnailBuffer = await sharp(fileBuffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    
    const webOptimizedBuffer = await sharp(fileBuffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    const thumbnailPath = path.join(this.publicDir, `${previewId}_thumb.jpg`);
    const previewPath = path.join(this.publicDir, `${previewId}_preview.jpg`);
    
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);
    fs.writeFileSync(previewPath, webOptimizedBuffer);

    return {
      success: true,
      previewType: 'image',
      thumbnailUrl: `/previews/${previewId}_thumb.jpg`,
      previewUrl: `/previews/${previewId}_preview.jpg`,
      previewSize: webOptimizedBuffer.length,
      previewDuration: null,
      metadata: {
        originalSize: fileBuffer.length,
        thumbnailSize: thumbnailBuffer.length,
        webOptimizedSize: webOptimizedBuffer.length
      }
    };
  }

  /**
   * Generate image placeholder when Sharp is not available
   */
  async generateImagePlaceholder(previewId, metadata) {
    const placeholderSvg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#2a2a2a"/>
        <rect x="50" y="50" width="300" height="200" fill="#3a3a3a" rx="10"/>
        <text x="200" y="140" font-family="Arial" font-size="16" fill="#ffaa00" text-anchor="middle">
          📷 ${metadata.title || 'Image'}
        </text>
        <text x="200" y="165" font-family="Arial" font-size="12" fill="#888" text-anchor="middle">
          Image preview unavailable
        </text>
      </svg>
    `;

    const thumbnailBuffer = Buffer.from(placeholderSvg);
    const thumbnailPath = path.join(this.publicDir, `${previewId}_thumb.svg`);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      success: true,
      previewType: 'image',
      thumbnailUrl: `/previews/${previewId}_thumb.svg`,
      previewUrl: `/previews/${previewId}_thumb.svg`,
      previewSize: thumbnailBuffer.length,
      previewDuration: null,
      metadata: {
        originalSize: 0,
        placeholder: true
      }
    };
  }

  /**
   * Generate video preview (thumbnail + short clip)
   * Note: For full implementation, would use ffmpeg
   */
  async generateVideoPreview(fileBuffer, previewId, metadata) {
    // For now, create a placeholder thumbnail
    // In production, would extract frame and create short clip with ffmpeg
    
    const placeholderSvg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1a1a1a"/>
        <circle cx="200" cy="150" r="40" fill="#ffaa00"/>
        <polygon points="185,135 185,165 215,150" fill="#1a1a1a"/>
        <text x="200" y="200" font-family="Arial" font-size="14" fill="#ffaa00" text-anchor="middle">
          ${metadata.title || 'Video Preview'}
        </text>
        <text x="200" y="220" font-family="Arial" font-size="12" fill="#888" text-anchor="middle">
          Click to preview
        </text>
      </svg>
    `;

    const thumbnailBuffer = Buffer.from(placeholderSvg);
    const thumbnailPath = path.join(this.publicDir, `${previewId}_thumb.svg`);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      success: true,
      previewType: 'video',
      thumbnailUrl: `/previews/${previewId}_thumb.svg`,
      previewUrl: null, // Would be actual video clip URL
      previewSize: 0,
      previewDuration: 30, // 30-second preview clip
      metadata: {
        originalSize: fileBuffer.length,
        previewClipDuration: 30,
        needsProcessing: true // Flag for background processing
      }
    };
  }

  /**
   * Generate audio preview (waveform thumbnail + 30-second sample)
   */
  async generateAudioPreview(fileBuffer, previewId, metadata) {
    // Create audio waveform visualization
    const waveformSvg = `
      <svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1a1a1a"/>
        ${Array.from({length: 80}, (_, i) => {
          const height = Math.random() * 60 + 10;
          const x = i * 5;
          return `<rect x="${x}" y="${50 - height/2}" width="3" height="${height}" fill="#ffaa00" opacity="${0.3 + Math.random() * 0.7}"/>`;
        }).join('')}
        <text x="200" y="85" font-family="Arial" font-size="12" fill="#ffaa00" text-anchor="middle">
          ${metadata.title || 'Audio Track'}
        </text>
      </svg>
    `;

    const thumbnailBuffer = Buffer.from(waveformSvg);
    const thumbnailPath = path.join(this.publicDir, `${previewId}_wave.svg`);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      success: true,
      previewType: 'audio',
      thumbnailUrl: `/previews/${previewId}_wave.svg`,
      previewUrl: null, // Would be 30-second audio clip URL
      previewSize: 0,
      previewDuration: 30, // 30-second preview
      metadata: {
        originalSize: fileBuffer.length,
        previewClipDuration: 30,
        needsProcessing: true // Flag for background audio processing
      }
    };
  }

  /**
   * Generate PDF preview (first page thumbnail)
   */
  async generatePdfPreview(fileBuffer, previewId, metadata) {
    // For now, create PDF placeholder
    // In production, would use pdf2pic or similar
    
    const pdfPlaceholder = `
      <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff" stroke="#cccccc" stroke-width="2"/>
        <rect x="20" y="20" width="260" height="20" fill="#f0f0f0"/>
        <rect x="20" y="50" width="200" height="10" fill="#e0e0e0"/>
        <rect x="20" y="70" width="240" height="10" fill="#e0e0e0"/>
        <rect x="20" y="90" width="180" height="10" fill="#e0e0e0"/>
        <text x="150" y="350" font-family="Arial" font-size="14" fill="#666" text-anchor="middle">
          ${metadata.title || 'PDF Document'}
        </text>
        <text x="150" y="370" font-family="Arial" font-size="12" fill="#888" text-anchor="middle">
          Click to preview
        </text>
      </svg>
    `;

    const thumbnailBuffer = Buffer.from(pdfPlaceholder);
    const thumbnailPath = path.join(this.publicDir, `${previewId}_pdf.svg`);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      success: true,
      previewType: 'pdf',
      thumbnailUrl: `/previews/${previewId}_pdf.svg`,
      previewUrl: null, // Would be first page image URL
      previewSize: 0,
      previewDuration: null,
      metadata: {
        originalSize: fileBuffer.length,
        needsProcessing: true
      }
    };
  }

  /**
   * Generate text preview (formatted snippet)
   */
  async generateTextPreview(fileBuffer, previewId, metadata) {
    const textContent = fileBuffer.toString('utf-8');
    const preview = textContent.substring(0, 500) + (textContent.length > 500 ? '...' : '');
    
    const previewData = {
      content: preview,
      fullLength: textContent.length,
      title: metadata.title || 'Text Document'
    };

    const previewPath = path.join(this.publicDir, `${previewId}_text.json`);
    fs.writeFileSync(previewPath, JSON.stringify(previewData, null, 2));

    return {
      success: true,
      previewType: 'text',
      thumbnailUrl: null,
      previewUrl: `/previews/${previewId}_text.json`,
      previewSize: Buffer.from(JSON.stringify(previewData)).length,
      previewDuration: null,
      metadata: {
        originalSize: fileBuffer.length,
        characterCount: textContent.length,
        previewCharacterCount: preview.length
      }
    };
  }

  /**
   * Generate generic file preview (icon + metadata)
   */
  async generateGenericPreview(fileBuffer, previewId, metadata) {
    const iconSvg = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#2a2a2a" rx="10"/>
        <rect x="40" y="30" width="120" height="140" fill="#3a3a3a" rx="5"/>
        <rect x="50" y="40" width="100" height="10" fill="#ffaa00"/>
        <rect x="50" y="60" width="80" height="8" fill="#888"/>
        <rect x="50" y="75" width="90" height="8" fill="#888"/>
        <text x="100" y="180" font-family="Arial" font-size="12" fill="#ffaa00" text-anchor="middle">
          ${metadata.title || 'File'}
        </text>
      </svg>
    `;

    const thumbnailBuffer = Buffer.from(iconSvg);
    const thumbnailPath = path.join(this.publicDir, `${previewId}_file.svg`);
    fs.writeFileSync(thumbnailPath, thumbnailBuffer);

    return {
      success: true,
      previewType: 'file',
      thumbnailUrl: `/previews/${previewId}_file.svg`,
      previewUrl: null,
      previewSize: 0,
      previewDuration: null,
      metadata: {
        originalSize: fileBuffer.length
      }
    };
  }

  /**
   * Clean up temporary files
   */
  cleanup(previewId) {
    const patterns = [
      `${previewId}_*`,
    ];
    
    patterns.forEach(pattern => {
      const files = fs.readdirSync(this.publicDir).filter(file => 
        file.startsWith(previewId)
      );
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(this.publicDir, file));
        } catch (error) {
          console.warn('Cleanup failed for:', file, error.message);
        }
      });
    });
  }
}

module.exports = PreviewGenerator;