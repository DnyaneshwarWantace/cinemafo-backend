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

  // Get frontend URL from environment variables for proxy URLs
  static getBackendUrl() {
    return process.env.FRONTEND_URL || process.env.BACKEND_URL || 'https://cinema.bz/api';
  }

  // Generate dynamic URL based on request context
  static generateProxyUrl(filename, req = null) {
    let baseUrl;
    
    if (req && req.headers && req.headers.host) {
      // Use the request's host (dynamic based on where request comes from)
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      baseUrl = `${protocol}://${req.headers.host}/api`;
    } else {
      // Fallback to environment variable
      baseUrl = StorjService.getBackendUrl();
    }
    
    return `${baseUrl}/storj-proxy/${filename}`;
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
  async uploadGifFromUrl(gifUrl, adKey, req = null) {
    let filepath = null;
    
    try {
      console.log(`[Storj] Starting upload for ${adKey}: ${gifUrl}`);
      
      // Check if this is a Storj URL - if so, copy the existing file instead
      if (gifUrl.includes('gateway.storjshare.io') || gifUrl.includes('/storj-proxy/')) {
        console.log(`[Storj] Detected Storj URL for ${adKey} - copying existing file`);
        
        // Extract filename from Storj URL
        let filename;
        if (gifUrl.includes('/storj-proxy/')) {
          filename = gifUrl.split('/storj-proxy/')[1];
        } else {
          filename = gifUrl.split('/cinema-ads/')[1];
        }
        
        // Copy the existing file
        const result = await this.copyStorjFile(filename, adKey, req);
        console.log(`[Storj] Successfully copied ${adKey}: ${result.displayUrl}`);
        return result;
      }
      
      // Download the GIF from external URL
      filepath = await this.downloadFile(gifUrl, adKey);
      
      // Upload to Storj
      const result = await this.uploadFile(filepath, adKey, req);
      
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
      
      // Check if this is a Storj URL - if so, we need to handle it differently
      if (url.includes('gateway.storjshare.io') || url.includes('/storj-proxy/')) {
        console.log(`[Storj] Detected Storj URL for ${adKey} - this should not be re-uploaded`);
        throw new Error('Cannot re-upload from Storj URLs. Please use the original external URL instead.');
      }
      
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
   * Copy an existing Storj file to a new location (for reusing the same image)
   */
  async copyStorjFile(sourceFilename, newAdKey, req = null) {
    try {
      console.log(`[Storj] Copying file ${sourceFilename} for ${newAdKey}`);
      
      if (!this.s3) {
        throw new Error('Storj not initialized');
      }
      
      const newFilename = `${newAdKey}_${Date.now()}.gif`;
      
      // Copy the file within Storj
      await this.s3.copyObject({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceFilename}`,
        Key: newFilename
      }).promise();
      
      console.log(`[Storj] File copied: ${sourceFilename} -> ${newFilename}`);
      
      // Generate the proxy URL dynamically
      const displayUrl = StorjService.generateProxyUrl(newFilename, req);
      
      return {
        success: true,
        fileId: newFilename,
        displayUrl: newFilename, // Only save filename, not full URL
        downloadUrl: newFilename, // Only save filename, not full URL
        filename: newFilename,
        size: 0, // We don't know the size without additional API call
        mimeType: 'image/gif'
      };
      
    } catch (error) {
      console.error(`[Storj] Copy failed for ${newAdKey}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload file to Storj
   */
  async uploadFile(filepath, adKey, req = null) {
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
      
      // Generate the display URL dynamically based on request context
      const displayUrl = StorjService.generateProxyUrl(filename, req);
      const downloadUrl = displayUrl; // Same URL for download
       
       console.log(`[Storj] Generated backend proxy URL for ${adKey}`);
      
      console.log(`[Storj] Generated URLs for ${adKey}:`);
      console.log(`[Storj]    Display: ${displayUrl}`);
      console.log(`[Storj]    Download: ${downloadUrl}`);
      
      return {
        success: true,
        fileId: filename, // Use filename as ID
        displayUrl: filename, // Only save filename, not full URL
        downloadUrl: filename, // Only save filename, not full URL
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
   * Set bucket policy to allow public read access
   */
  async setBucketPublicPolicy() {
    try {
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${this.bucketName}/*`
          }
        ]
      };

      await this.s3.putBucketPolicy({
        Bucket: this.bucketName,
        Policy: JSON.stringify(bucketPolicy)
      }).promise();
      
      console.log(`[Storj] Bucket policy set for public access`);
    } catch (error) {
      console.warn(`[Storj] Could not set bucket policy (this might be normal for Storj):`, error.message);
      // Don't throw error - Storj might handle public access differently
    }
  }
}

module.exports = StorjService;
