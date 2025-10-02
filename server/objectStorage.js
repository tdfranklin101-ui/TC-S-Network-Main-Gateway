const fetch = require('node-fetch');

class ObjectStorageService {
  constructor() {
    this.bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  }

  // Search for a public object using direct URL
  async searchPublicObject(filePath) {
    if (!this.bucketId) {
      throw new Error('Object storage bucket not configured');
    }

    try {
      const objectUrl = `https://storage.googleapis.com/${this.bucketId}/public/${filePath}`;
      const response = await fetch(objectUrl, { method: 'HEAD' });
      
      if (response.ok) {
        return { url: objectUrl, response };
      }
      return null;
    } catch (error) {
      console.error('Error searching for public object:', error);
      return null;
    }
  }

  // Download object and stream to response with proper Range request support
  async downloadObject(fileInfo, res, req = null) {
    try {
      // First, get the file size with a HEAD request
      const headResponse = await fetch(fileInfo.url, { method: 'HEAD' });
      
      if (!headResponse.ok) {
        throw new Error(`Failed to fetch file info: ${headResponse.status}`);
      }

      const fileSize = parseInt(headResponse.headers.get('content-length') || '0', 10);
      const contentType = headResponse.headers.get('content-type') || 'video/mp4';

      // Check if client sent a Range header
      const rangeHeader = req?.headers?.range;
      
      if (rangeHeader && fileSize > 0) {
        // Parse Range header (format: "bytes=start-end")
        const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(rangeParts[0], 10);
        const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : fileSize - 1;
        
        // Validate range
        if (start >= fileSize || end >= fileSize) {
          res.writeHead(416, {
            'Content-Range': `bytes */${fileSize}`
          });
          res.end();
          return;
        }

        const chunkSize = (end - start) + 1;

        // Fetch only the requested byte range from Google Cloud Storage
        const rangeResponse = await fetch(fileInfo.url, {
          headers: {
            'Range': `bytes=${start}-${end}`
          }
        });

        if (!rangeResponse.ok) {
          throw new Error(`Failed to fetch range: ${rangeResponse.status}`);
        }

        // Return HTTP 206 Partial Content
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': chunkSize,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600'
        });

        // Stream the partial content
        rangeResponse.body.pipe(res);
        
      } else {
        // No Range header - send entire file
        const response = await fetch(fileInfo.url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600'
        });

        response.body.pipe(res);
      }
      
    } catch (error) {
      console.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Error downloading file');
      }
    }
  }

  // Stream video with Range request support (wrapper for backward compatibility)
  async streamVideo(fileInfo, res, req) {
    return this.downloadObject(fileInfo, res, req);
  }
}

module.exports = { ObjectStorageService };
