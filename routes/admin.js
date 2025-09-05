const express = require('express');
const router = express.Router();
const SiteSettings = require('../models/SiteSettings');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const sharp = require('sharp');
const FormData = require('form-data');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dexlsqpbv',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Public endpoint to get site settings
router.get('/public/settings', async (req, res) => {
  try {
    console.log('Fetching public settings...');
    let settings = await SiteSettings.findOne();
    console.log('Raw settings from DB:', settings);
    
    if (!settings) {
      console.log('No settings found, creating default settings...');
      settings = await SiteSettings.create({});
      console.log('Created default settings:', settings);
    }
    
    // Only send necessary public settings
    const publicSettings = {
      appearance: {
        announcementBar: settings.appearance.announcementBar,
        floatingSocialButtons: settings.appearance.floatingSocialButtons
      },
      content: {
        disclaimer: settings.content.disclaimer,
        aboutUs: settings.content.aboutUs,
        socialLinks: settings.content.socialLinks || {
          discord: 'https://discord.gg/cinema-fo',
          telegram: 'https://t.me/cinema-fo'
        }
      },
      ads: settings.ads
    };
    
    console.log('Sending public settings:', publicSettings);
    res.json(publicSettings);
  } catch (error) {
    console.error('Error fetching public site settings:', error);
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

// Middleware to verify admin token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.adminId = decoded.adminId;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    // Check if token is expired specifically
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        expired: true,
        expiredAt: error.expiredAt 
      });
    }
    
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Token refresh endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Verify the token (even if expired) to get the admin ID
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      // If token is expired, try to decode it without verification
      if (error.name === 'TokenExpiredError') {
        decoded = jwt.decode(token);
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (!decoded || !decoded.adminId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Verify admin still exists
    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    // Create new token
    const newToken = jwt.sign(
      { adminId: admin._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({ 
      token: newToken,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Get site settings
router.get('/settings', verifyToken, async (req, res) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      // Create default settings if none exist
      settings = await SiteSettings.create({});
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching site settings:', error);
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

// Update announcement bar settings
router.put('/settings/announcement', verifyToken, async (req, res) => {
  try {
    const { 
      enabled, 
      text, 
      backgroundColor, 
      textColor, 
      height, 
      textSize, 
      textWeight, 
      textStyle 
    } = req.body;
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    
    settings.appearance.announcementBar = {
      enabled: enabled || false,
      text: text || '',
      backgroundColor: backgroundColor || 'linear-gradient(135deg, #1e40af, #1e3a8a)',
      textColor: textColor || '#ffffff',
      height: height || 48,
      textSize: textSize || 'text-sm md:text-base',
      textWeight: textWeight || 'font-medium',
      textStyle: textStyle || 'normal'
    };
    
    await settings.save();
    res.json(settings.appearance.announcementBar);
  } catch (error) {
    console.error('Error updating announcement settings:', error);
    res.status(500).json({ error: 'Failed to update announcement settings' });
  }
});

// Update floating social buttons settings
router.put('/settings/social-buttons', verifyToken, async (req, res) => {
  try {
    const { enabled, discordEnabled, telegramEnabled, discordUrl, telegramUrl } = req.body;
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    
    settings.appearance.floatingSocialButtons = {
      enabled: enabled || false,
      discordEnabled: discordEnabled || false,
      telegramEnabled: telegramEnabled || false,
      discordUrl: discordUrl || '',
      telegramUrl: telegramUrl || ''
    };
    
    await settings.save();
    res.json(settings.appearance.floatingSocialButtons);
  } catch (error) {
    console.error('Error updating social buttons settings:', error);
    res.status(500).json({ error: 'Failed to update social buttons settings' });
  }
});

// Update social links settings
router.put('/settings/social-links', verifyToken, async (req, res) => {
  try {
    const { discord, telegram } = req.body;
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    
    // Update social links in content
    settings.content.socialLinks = {
      discord: discord || '',
      telegram: telegram || ''
    };
    
    await settings.save();
    res.json(settings.content.socialLinks);
  } catch (error) {
    console.error('Error updating social links settings:', error);
    res.status(500).json({ error: 'Failed to update social links settings' });
  }
});

// Update content settings (disclaimer and about us only)
router.put('/settings/content', verifyToken, async (req, res) => {
  try {
    console.log('📝 Updating content settings...');
    const { disclaimer, aboutUs } = req.body;
    console.log('📤 Received data:', { disclaimer, aboutUs });
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      console.log('📄 No settings found, creating new settings...');
      settings = new SiteSettings();
    }
    
    console.log('📊 Current settings.content:', settings.content);
    
    // Only update disclaimer and about us - do NOT touch social links
    // Use $set to update only specific fields without affecting socialLinks
    settings.content.disclaimer = disclaimer || '';
    settings.content.aboutUs = aboutUs || '';
    
    console.log('💾 Saving settings...');
    await settings.save();
    console.log('✅ Settings saved successfully');
    console.log('📤 Returning updated content:', settings.content);
    res.json(settings.content);
  } catch (error) {
    console.error('❌ Error updating content settings:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update content settings' });
  }
});

// Update ads settings
router.put('/settings/ads', verifyToken, async (req, res) => {
  try {
    const adSettings = req.body;
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    
    // Track which ads need uploading to Cloudinary
    const adsToUpload = [];
    
    // Update each ad setting
    Object.keys(adSettings).forEach(adKey => {
      if (settings.ads[adKey]) {
        const oldImageUrl = settings.ads[adKey].imageUrl;
        const newImageUrl = adSettings[adKey].imageUrl || '';
        
        settings.ads[adKey] = {
          enabled: adSettings[adKey].enabled || false,
          imageUrl: newImageUrl,
          cloudinaryUrl: newImageUrl !== oldImageUrl ? '' : (adSettings[adKey].cloudinaryUrl || settings.ads[adKey].cloudinaryUrl || ''),
          clickUrl: adSettings[adKey].clickUrl || ''
        };
        
        // Check if image URL changed and needs uploading to Cloudinary
        if (newImageUrl && newImageUrl !== oldImageUrl && !settings.ads[adKey].cloudinaryUrl) {
          adsToUpload.push({ adKey, imageUrl: newImageUrl });
        }
      }
    });
    
    await settings.save();
    
            // Start background uploads to Tenor for new images
        if (adsToUpload.length > 0) {
          console.log(`Starting background Tenor upload for ${adsToUpload.length} ads`);
          adsToUpload.forEach(({ adKey, imageUrl }) => {
            uploadImageToTenor(adKey, imageUrl, settings._id);
          });
        }
    
    res.json(settings.ads);
  } catch (error) {
    console.error('Error updating ads settings:', error);
    res.status(500).json({ error: 'Failed to update ads settings' });
  }
});

// Background image upload to Tenor function
async function uploadImageToTenor(adKey, imageUrl, settingsId) {
  try {
    console.log(`[Background] Starting Tenor upload for ${adKey}: ${imageUrl}`);
    
    // Download image from URL
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    // Upload to Tenor (free hosting for large GIFs up to 25MB)
    console.log(`[Background Tenor] Uploading ${adKey} to Tenor`);
    
    const tenorApiKey = process.env.TENOR_API_KEY;
    if (!tenorApiKey) {
      throw new Error('Tenor API key not configured');
    }
    
    // Check file size before uploading
    const fileSizeMB = (response.data.length / 1024 / 1024).toFixed(2);
    console.log(`[Background Tenor Debug] File size: ${fileSizeMB}MB`);
    
    if (response.data.length > 25 * 1024 * 1024) { // 25MB limit for Tenor
      throw new Error(`File too large (${fileSizeMB}MB). Tenor has a 25MB limit.`);
    }
    
    // Convert buffer to base64
    const base64Image = Buffer.from(response.data).toString('base64');
    
    // Upload to Tenor using their upload API
    console.log(`[Background Tenor Debug] Uploading image to Tenor...`);
    const tenorResponse = await axios.post('https://tenor.googleapis.com/v2/upload', {
      key: tenorApiKey,
      data: base64Image,
      filename: `${adKey}_${Date.now()}.gif`
    }, {
      timeout: 120000 // 2 minutes for large files
    });
    
    console.log(`[Background Tenor Debug] Response status: ${tenorResponse.status}`);
    console.log(`[Background Tenor Debug] Response data:`, tenorResponse.data);
    
    if (!tenorResponse.data.success) {
      throw new Error(`Tenor upload failed: ${tenorResponse.data.error?.message || 'Unknown error'}`);
    }
    
    const tenorUrl = tenorResponse.data.data.url;
    console.log(`[Background Tenor] Successfully uploaded ${adKey}: ${tenorUrl}`);
    
    // Update the database with Tenor URL
    const settings = await SiteSettings.findById(settingsId);
    if (settings && settings.ads[adKey]) {
      settings.ads[adKey].cloudinaryUrl = tenorUrl;
      await settings.save();
      console.log(`[Background] Successfully uploaded to Tenor and updated ${adKey}: ${settings.ads[adKey].cloudinaryUrl}`);
    }
    
  } catch (error) {
    console.error(`[Background] Error uploading image to Tenor for ${adKey}:`, error);
    
    // Fallback to local storage if Tenor fails
    try {
      console.log(`[Background Fallback] Saving ${adKey} locally`);
      
      const fs = require('fs');
      const path = require('path');
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'ads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate filename
      const filename = `${adKey}_${Date.now()}.gif`;
      const filePath = path.join(uploadsDir, filename);
      
      // Save the image
      fs.writeFileSync(filePath, response.data);
      
      // Update the database with local URL
      const settings = await SiteSettings.findById(settingsId);
      if (settings && settings.ads[adKey]) {
        settings.ads[adKey].cloudinaryUrl = `/api/admin/ad-images/${filename}`;
        await settings.save();
        console.log(`[Background Fallback] Successfully saved locally and updated ${adKey}: ${settings.ads[adKey].cloudinaryUrl}`);
      }
    } catch (fallbackError) {
      console.error(`[Background Fallback] Error saving locally for ${adKey}:`, fallbackError);
    }
  }
}

// Upload ad image to Cloudinary
router.post('/upload-ad-image', verifyToken, async (req, res) => {
  try {
    const { adKey, imageUrl } = req.body;
    
    if (!adKey || !imageUrl) {
      return res.status(400).json({ error: 'Ad key and image URL are required' });
    }
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    
    // Check if the ad exists
    if (!settings.ads[adKey]) {
      return res.status(400).json({ error: 'Invalid ad key' });
    }
    
    console.log(`[Manual Upload] Starting ImgBB upload for ${adKey}: ${imageUrl}`);
    
    // Download image from URL and upload to Cloudinary
    let response;
    try {
      response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500; // Accept all status codes less than 500
        }
      });
      
      if (response.status !== 200) {
        return res.status(400).json({ 
          error: `Failed to download image: HTTP ${response.status} - Image not found or inaccessible` 
        });
      }
    } catch (downloadError) {
      console.error('Error downloading image:', downloadError);
      return res.status(400).json({ 
        error: `Failed to download image: ${downloadError.message}` 
      });
    }
    
    // Only compress non-GIF images if they're too large
    let processedBuffer = response.data;
    const originalSize = response.data.length;
    
    // Check if it's a GIF by content type or file extension
    const isGif = response.headers['content-type']?.includes('gif') || 
                  imageUrl.toLowerCase().includes('.gif');
    
    if (originalSize > 10 * 1024 * 1024 && !isGif) { // Only compress if larger than 10MB AND not a GIF
      console.log(`[Image Processing] Compressing non-GIF image for ${adKey} - Original size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
      
      try {
        const image = sharp(response.data);
        const metadata = await image.metadata();
        
        // For other formats, resize if too large
        let processedImage = image;
        if (metadata.width > 1920 || metadata.height > 1080) {
          processedImage = image.resize(1920, 1080, { 
            fit: 'inside',
            withoutEnlargement: true 
          });
        }
        
        if (metadata.format === 'png') {
          processedBuffer = await processedImage.png({ quality: 80 }).toBuffer();
        } else {
          processedBuffer = await processedImage.jpeg({ quality: 80 }).toBuffer();
        }
        
        console.log(`[Image Processing] Compressed ${adKey} - New size: ${(processedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      } catch (compressError) {
        console.error(`[Image Processing] Compression failed for ${adKey}, using original:`, compressError.message);
        processedBuffer = response.data;
      }
    } else if (isGif && originalSize > 10 * 1024 * 1024) {
      console.log(`[Image Processing] GIF too large (${(originalSize / 1024 / 1024).toFixed(2)}MB) but keeping original to preserve animation`);
    }
    
    // Convert buffer to base64
    const base64Image = Buffer.from(processedBuffer, 'binary').toString('base64');
    const dataURI = `data:${response.headers['content-type']};base64,${base64Image}`;
    
    // Upload to Tenor (free hosting for large GIFs up to 25MB)
    console.log(`[Tenor] Uploading ${adKey} to Tenor`);
    
    const tenorApiKey = process.env.TENOR_API_KEY;
    console.log(`[Tenor Debug] API Key configured: ${tenorApiKey ? 'Yes' : 'No'}`);
    if (!tenorApiKey) {
      throw new Error('Tenor API key not configured. Please add TENOR_API_KEY to your .env file');
    }
    
    // Check file size before uploading
    const fileSizeMB = (processedBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[Tenor Debug] File size: ${fileSizeMB}MB`);
    
    if (processedBuffer.length > 25 * 1024 * 1024) { // 25MB limit for Tenor
      throw new Error(`File too large (${fileSizeMB}MB). Tenor has a 25MB limit.`);
    }
    
    try {
      // Upload to Tenor using their upload API
      const tenorResponse = await axios.post('https://tenor.googleapis.com/v2/upload', {
        key: tenorApiKey,
        data: base64Image,
        filename: `${adKey}_${Date.now()}.gif`
      }, {
        timeout: 120000 // 2 minutes for large files
      });
      
      console.log(`[Manual Tenor Debug] Response status: ${tenorResponse.status}`);
      console.log(`[Manual Tenor Debug] Response data:`, tenorResponse.data);
      
      if (!tenorResponse.data.success) {
        throw new Error(`Tenor upload failed: ${tenorResponse.data.error?.message || 'Unknown error'}`);
      }
      
      const tenorUrl = tenorResponse.data.data.url;
      console.log(`[Tenor] Successfully uploaded ${adKey}: ${tenorUrl}`);
      
      // Update the ad setting with Tenor URL (keeping cloudinaryUrl field name)
      settings.ads[adKey].cloudinaryUrl = tenorUrl;
      await settings.save();
      
      res.json({ 
        success: true, 
        cloudinaryUrl: settings.ads[adKey].cloudinaryUrl,
        message: 'Image uploaded to Tenor successfully' 
      });
      
    } catch (uploadError) {
      console.error('Error uploading to Tenor:', uploadError);
      throw uploadError;
    }
    
  } catch (error) {
    console.error('Error uploading ad image to Tenor:', error);
    
    // Fallback to local storage if Tenor fails
    const isGif = response?.headers['content-type']?.includes('gif') || 
                  imageUrl.toLowerCase().includes('.gif');
    
    if (isGif || error.code === 'ECONNABORTED') {
      console.log(`[Fallback] Tenor failed (${error.code || 'unknown error'}), saving locally for ${adKey}`);
      
      try {
        // Fallback to local storage
        const fs = require('fs');
        const path = require('path');
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '..', 'uploads', 'ads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Generate filename
        const filename = `${adKey}_${Date.now()}.gif`;
        const filePath = path.join(uploadsDir, filename);
        
        // Save the GIF
        fs.writeFileSync(filePath, response.data);
        
        // Update the ad setting with local URL
        settings.ads[adKey].cloudinaryUrl = `/api/admin/ad-images/${filename}`;
        await settings.save();
        
        res.json({ 
          success: true, 
          cloudinaryUrl: settings.ads[adKey].cloudinaryUrl,
          message: 'GIF saved locally. Check your Tenor API key configuration.' 
        });
        return;
      } catch (saveError) {
        console.error('Error saving GIF locally:', saveError);
      }
    }
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload image';
    if (error.response?.status === 404) {
      errorMessage = 'Image not found at the provided URL';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Could not reach the image URL';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out while downloading image';
    } else if (error.response?.status === 400) {
      errorMessage = 'Invalid image format or file too large (max 25MB for Tenor)';
    } else if (error.response?.status === 401) {
      errorMessage = 'Invalid Tenor API key';
    } else if (error.response?.status === 429) {
      errorMessage = 'Tenor API rate limit exceeded. Please try again later.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Serve local ad images (fallback for large GIFs)
router.get('/ad-images/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'ads', filename);
    
    if (!require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Set appropriate headers
    const ext = require('path').extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Stream the file
    const stream = require('fs').createReadStream(filePath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('Error serving ad image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Update custom CSS
router.put('/settings/css', verifyToken, async (req, res) => {
  try {
    const { customCSS } = req.body;
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    
    settings.appearance.customCSS = customCSS || '';
    await settings.save();
    
    res.json({ customCSS: settings.appearance.customCSS });
  } catch (error) {
    console.error('Error updating custom CSS:', error);
    res.status(500).json({ error: 'Failed to update custom CSS' });
  }
});

module.exports = router; 