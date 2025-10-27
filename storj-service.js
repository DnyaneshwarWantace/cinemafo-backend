const AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class StorjService {
  // Ensure directory exists
  static ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  constructor() {
    this.s3 = null;
    this.bucketName = 'cinema-ads'; // Default bucket name
    this.initialize();
  }

  initialize() {
    try {
      // Check if required environment variables are set
      if (!process.env.STORJ_ACCESS_KEY) {
        throw new Error('STORJ_ACCESS_KEY environment variable is required');
      }
      if (!process.env.STORJ_SECRET_KEY) {
        throw new Error('STORJ_SECRET_KEY environment variable is required');
      }

      // Configure AWS SDK for Storj
      this.s3 = new AWS.S3({
        endpoint: process.env.STORJ_ENDPOINT || 'https://gateway.storjshare.io',
        accessKeyId: process.env.STORJ_ACCESS_KEY,
        secretAccessKey: process.env.STORJ_SECRET_KEY,
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
        region: 'us-east-1'
      });

      console.log('✅ Storj Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Storj Service:', error.message);
    }
  }

  /**
   * Upload GIF from URL to Storj
   */
  async uploadGifFromUrl(gifUrl, adKey) {
    let filepath = null;
    
    try {
      console.log(`[Storj] Starting upload for ${adKey}: ${gifUrl}`);
      
      // Download the GIF
      filepath = await this.downloadFile(gifUrl, adKey);
      
      // Upload to Storj
      const result = await this.uploadFile(filepath, adKey);
      
      console.log(`[Storj] Successfully uploaded ${adKey}: ${result.displayUrl}`);
      return result;
      
    } catch (error) {
      console.error(`[Storj] Upload failed for ${adKey}:`, error.message);
      throw error;
    } finally {
      // Cleanup downloaded file
      if (filepath && fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath);
          console.log(`[Storj] Cleaned up temp file for ${adKey}`);
        } catch (cleanupError) {
          console.error(`[Storj] Cleanup failed for ${adKey}:`, cleanupError.message);
        }
      }
    }
  }

  /**
   * Download file from URL
   */
  async downloadFile(url, adKey) {
    try {
      console.log(`[Storj] Downloading ${adKey} from: ${url}`);
      
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // Check if response is actually an image
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('image')) {
        throw new Error('URL does not point to an image file');
      }

      const filename = `${adKey}_${Date.now()}.gif`;
      const tempDir = path.join(__dirname, 'temp');
      StorjService.ensureDirSync(tempDir);
      const filepath = path.join(tempDir, filename);
      const writer = fs.createWriteStream(filepath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const stats = fs.statSync(filepath);
          console.log(`[Storj] Download completed for ${adKey}: ${stats.size} bytes`);
          resolve(filepath);
        });
        
        writer.on('error', (err) => {
          console.error(`[Storj] Download error for ${adKey}:`, err);
          reject(err);
        });
      });
      
    } catch (error) {
      console.error(`[Storj] Download failed for ${adKey}:`, error.message);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Upload file to Storj
   */
  async uploadFile(filepath, adKey) {
    try {
      console.log(`[Storj] Uploading ${adKey} to Storj...`);
      
      if (!this.s3) {
        throw new Error('Storj not initialized');
      }

      // Verify file exists and get size
      const stats = fs.statSync(filepath);
      console.log(`[Storj] File size for ${adKey}: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
      
      const filename = `${adKey}_${Date.now()}.gif`;
      
      // Upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: filename,
        Body: fs.createReadStream(filepath),
        ContentType: 'image/gif'
        // Note: Storj handles public access differently than AWS S3
        // Files are public by default in Storj
      };
      
      // Upload to Storj
      const response = await this.s3.upload(uploadParams).promise();
      
      console.log(`[Storj] File uploaded for ${adKey} - Location: ${response.Location}`);
      
      // Generate the display URL - try different approaches for public access
      let displayUrl = response.Location;
      let downloadUrl = response.Location;
      
       // Try to make file truly public (no expiry)
       try {
         // First, try to set the file as public
         await this.s3.putObjectAcl({
           Bucket: this.bucketName,
           Key: filename,
           ACL: 'public-read'
         }).promise();
         
         console.log(`[Storj] Set file as public for ${adKey}`);
         // Use direct URL (no expiry)
         displayUrl = response.Location;
         downloadUrl = response.Location;
         
       } catch (aclError) {
         console.warn(`[Storj] Could not set file as public, using pre-signed URL:`, aclError.message);
         
         // Fallback to pre-signed URL (7 days max)
         try {
           const presignedUrl = await this.s3.getSignedUrl('getObject', {
             Bucket: this.bucketName,
             Key: filename,
             Expires: 604800 // 7 days in seconds (max allowed)
           });
           
           displayUrl = presignedUrl;
           downloadUrl = presignedUrl;
           console.log(`[Storj] Generated pre-signed URL for ${adKey} (7 days expiry)`);
         } catch (presignError) {
           console.warn(`[Storj] Could not generate pre-signed URL, using direct URL:`, presignError.message);
         }
       }
      
      console.log(`[Storj] Generated URLs for ${adKey}:`);
      console.log(`[Storj]    Display: ${displayUrl}`);
      console.log(`[Storj]    Download: ${downloadUrl}`);
      
      return {
        success: true,
        fileId: filename, // Use filename as ID
        displayUrl: displayUrl,
        downloadUrl: downloadUrl,
        filename: filename,
        size: stats.size,
        mimeType: 'image/gif'
      };
      
    } catch (error) {
      console.error(`[Storj] Upload failed for ${adKey}:`, error);
      throw error;
    }
  }

  /**
   * Test Storj connection
   */
  async testConnection() {
    try {
      if (!this.s3) {
        throw new Error('Storj not initialized');
      }

      // Try to list buckets to test connection
      const response = await this.s3.listBuckets().promise();

      return {
        success: true,
        message: 'Storj API is working!',
        canListBuckets: true,
        buckets: response.Buckets.map(b => b.Name),
        testTime: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Storj API connection failed'
      };
    }
  }

  /**
   * Create bucket if it doesn't exist and make it public
   */
  async ensureBucketExists() {
    try {
      if (!this.s3) {
        throw new Error('Storj not initialized');
      }

      // Check if bucket exists
      try {
        await this.s3.headBucket({ Bucket: this.bucketName }).promise();
        console.log(`[Storj] Bucket '${this.bucketName}' already exists`);
        
        // Try to set bucket policy for public access
        await this.setBucketPublicPolicy();
        return true;
      } catch (error) {
        if (error.statusCode === 404) {
          // Bucket doesn't exist, create it
          console.log(`[Storj] Creating bucket '${this.bucketName}'...`);
          await this.s3.createBucket({ Bucket: this.bucketName }).promise();
          console.log(`[Storj] Bucket '${this.bucketName}' created successfully`);
          
          // Set bucket policy for public access
          await this.setBucketPublicPolicy();
          return true;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`[Storj] Error ensuring bucket exists:`, error.message);
      throw error;
    }
  }

  /**
   * Refresh pre-signed URL if it's close to expiring
   */
  async refreshPresignedUrl(fileKey, adKey) {
    try {
      if (!this.s3) {
        throw new Error('Storj not initialized');
      }

      // Generate new pre-signed URL (7 days expiry)
      const presignedUrl = await this.s3.getSignedUrl('getObject', {
        Bucket: this.bucketName,
        Key: fileKey,
        Expires: 604800 // 7 days in seconds
      });

      console.log(`[Storj] Refreshed pre-signed URL for ${adKey}`);
      return presignedUrl;
    } catch (error) {
      console.error(`[Storj] Failed to refresh URL for ${adKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a pre-signed URL is close to expiring (within 1 day)
   */
  isUrlExpiringSoon(url) {
    try {
      const urlObj = new URL(url);
      const expiresParam = urlObj.searchParams.get('X-Amz-Expires');
      const dateParam = urlObj.searchParams.get('X-Amz-Date');
      
      if (!expiresParam || !dateParam) {
        return false; // Not a pre-signed URL
      }

      // Parse the date and calculate expiry
      const startDate = new Date(dateParam);
      const expiresInSeconds = parseInt(expiresParam);
      const expiryDate = new Date(startDate.getTime() + (expiresInSeconds * 1000));
      const now = new Date();
      
      // Check if expires within 24 hours (86400 seconds)
      const timeUntilExpiry = expiryDate.getTime() - now.getTime();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      return timeUntilExpiry < oneDayInMs;
    } catch (error) {
      console.warn(`[Storj] Could not parse URL expiry:`, error.message);
      return false;
    }
  }
}

module.exports = StorjService;
