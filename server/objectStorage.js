const { Storage } = require('@google-cloud/storage');

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Object storage client configured for Replit
const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

class ObjectStorageService {
  constructor() {
    this.bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  }

  // Search for a public object
  async searchPublicObject(filePath) {
    if (!this.bucketId) {
      throw new Error('Object storage bucket not configured');
    }

    try {
      const bucket = objectStorageClient.bucket(this.bucketId);
      const file = bucket.file(`public/${filePath}`);
      
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
      return null;
    } catch (error) {
      console.error('Error searching for public object:', error);
      return null;
    }
  }

  // Download object and stream to response
  async downloadObject(file, res) {
    try {
      const [metadata] = await file.getMetadata();
      
      // Set appropriate headers for video streaming
      res.writeHead(200, {
        'Content-Type': metadata.contentType || 'video/mp4',
        'Content-Length': metadata.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });

      // Stream the file
      const stream = file.createReadStream();
      stream.pipe(res);
      
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Error streaming file');
        }
      });
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