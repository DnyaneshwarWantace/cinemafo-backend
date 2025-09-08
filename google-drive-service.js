const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class GoogleDriveService {
  // Ensure directory exists
  static ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  constructor() {
    this.oauth2Client = null;
    this.drive = null;
    this.initialize();
  }

  initialize() {
    try {
      // Check if required environment variables are set
      if (!process.env.GOOGLE_DRIVE_CLIENT_ID) {
        throw new Error('GOOGLE_DRIVE_CLIENT_ID environment variable is required');
      }
      if (!process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
        throw new Error('GOOGLE_DRIVE_CLIENT_SECRET environment variable is required');
      }
      if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
        throw new Error('GOOGLE_DRIVE_REFRESH_TOKEN environment variable is required'); //new
      }

      // Initialize OAuth2 client
      const BASE_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}/api`;
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        `${BASE_URL}/callback`
      );

      // Set credentials with your refresh token
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
      });

      // Initialize Drive API
      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      console.log('✅ Google Drive Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive Service:', error.message);
    }
  }

  /**
   * Upload GIF from URL to Google Drive
   */
  async uploadGifFromUrl(gifUrl, adKey) {
    let filepath = null;
    
    try {
      console.log(`[Google Drive] Starting upload for ${adKey}: ${gifUrl}`);
      
      // Download the GIF
      filepath = await this.downloadFile(gifUrl, adKey);
      
      // Upload to Google Drive
      const result = await this.uploadFile(filepath, adKey);
      
      console.log(`[Google Drive] Successfully uploaded ${adKey}: ${result.displayUrl}`);
      return result;
      
    } catch (error) {
      console.error(`[Google Drive] Upload failed for ${adKey}:`, error.message);
      throw error;
    } finally {
      // Cleanup downloaded file
      if (filepath && fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath);
          console.log(`[Google Drive] Cleaned up temp file for ${adKey}`);
        } catch (cleanupError) {
          console.error(`[Google Drive] Cleanup failed for ${adKey}:`, cleanupError.message);
        }
      }
    }
  }

  /**
   * Download file from URL
   */
  async downloadFile(url, adKey) {
    try {
      console.log(`[Google Drive] Downloading ${adKey} from: ${url}`);
      
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
      GoogleDriveService.ensureDirSync(tempDir);
      const filepath = path.join(tempDir, filename);
      const writer = fs.createWriteStream(filepath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const stats = fs.statSync(filepath);
          console.log(`[Google Drive] Download completed for ${adKey}: ${stats.size} bytes`);
          resolve(filepath);
        });
        
        writer.on('error', (err) => {
          console.error(`[Google Drive] Download error for ${adKey}:`, err);
          reject(err);
        });
      });
      
    } catch (error) {
      console.error(`[Google Drive] Download failed for ${adKey}:`, error.message);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(filepath, adKey) {
    try {
      console.log(`[Google Drive] Uploading ${adKey} to Google Drive...`);
      
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Verify file exists and get size
      const stats = fs.statSync(filepath);
      console.log(`[Google Drive] File size for ${adKey}: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
      
      const filename = `${adKey}_${Date.now()}.gif`;
      
      const fileMetadata = {
        name: filename,
        parents: ['root']
      };
      
      const media = {
        mimeType: 'image/gif',
        body: fs.createReadStream(filepath)
      };
      
      // Upload to Google Drive
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,size,mimeType'
      });
      
      const fileId = response.data.id;
      console.log(`[Google Drive] File uploaded for ${adKey} - ID: ${fileId}`);
      
      // Make file publicly accessible
      console.log(`[Google Drive] Setting public permissions for ${adKey}...`);
      try {
        await this.drive.permissions.create({
          fileId: fileId,
          resource: {
            role: 'reader',
            type: 'anyone'
          }
        });
        console.log(`[Google Drive] Public permissions set for ${adKey}`);
      } catch (permError) {
        console.warn(`[Google Drive] Permission warning for ${adKey}:`, permError.message);
        // Continue anyway - file might still be accessible
      }
      
      // Wait for permission propagation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate the working URLs
      const displayUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000-h1000`;
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      
      console.log(`[Google Drive] Generated URLs for ${adKey}:`);
      console.log(`[Google Drive]    Display: ${displayUrl}`);
      console.log(`[Google Drive]    Download: ${downloadUrl}`);
      
      return {
        success: true,
        fileId: fileId,
        displayUrl: displayUrl,
        downloadUrl: downloadUrl,
        filename: filename,
        size: response.data.size,
        mimeType: response.data.mimeType
      };
      
    } catch (error) {
      console.error(`[Google Drive] Upload failed for ${adKey}:`, error);
      throw error;
    }
  }

  /**
   * Test Google Drive connection
   */
  async testConnection() {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)'
      });

      return {
        success: true,
        message: 'Google Drive API is working!',
        canListFiles: true,
        testTime: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Google Drive API connection failed'
      };
    }
  }
}

module.exports = GoogleDriveService;
