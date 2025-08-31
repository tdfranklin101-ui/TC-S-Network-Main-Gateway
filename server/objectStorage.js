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

  // Download object and stream to response
  async downloadObject(fileInfo, res) {
    try {
      const response = await fetch(fileInfo.url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      // Set appropriate headers for video streaming
      res.writeHead(200, {
        'Content-Type': response.headers.get('content-type') || 'video/mp4',
        'Content-Length': response.headers.get('content-length'),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });

      // Stream the response
      response.body.pipe(res);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Error downloading file');
      }
    }
  }
}

module.exports = { ObjectStorageService };