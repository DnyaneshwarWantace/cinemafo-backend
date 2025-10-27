const express = require('express');
const router = express.Router();
const SiteSettings = require('../models/SiteSettings');
const Admin = require('../models/Admin');
const AdClick = require('../models/AdClick');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const sharp = require('sharp');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const StorjService = require('../storj-service.js');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dexlsqpbv',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Initialize Storj Service
const storjService = new StorjService();

// Helper function to generate dynamic URLs for ads
function generateDynamicAdUrls(ads, req) {
  const dynamicAds = {};
  Object.keys(ads).forEach(adKey => {
    const ad = ads[adKey];
    if (ad.enabled && ad.cloudinaryUrl) {
      // Check if it's a Storj filename (not a full URL)
      if (ad.cloudinaryUrl.includes('_') && ad.cloudinaryUrl.endsWith('.gif') && !ad.cloudinaryUrl.startsWith('http')) {
        // It's a Storj filename, generate dynamic URL
        const backendUrl = req.headers.host ? 
          `${req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')}://${req.headers.host}/api` :
          (process.env.FRONTEND_URL || process.env.BACKEND_URL || 'https://cinema.bz/api');
        dynamicAds[adKey] = {
          imageUrl: `${backendUrl}/storj-proxy/${ad.cloudinaryUrl}`,
          clickUrl: ad.clickUrl
        };
      } else {
        // It's already a full URL (legacy or external)
        dynamicAds[adKey] = {
          imageUrl: ad.cloudinaryUrl,
          clickUrl: ad.clickUrl
        };
      }
    }
  });
  return dynamicAds;
}

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
    
    // Generate dynamic URLs for ads based on current request
    const dynamicAds = generateDynamicAdUrls(settings.ads, req);
    
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
      ads: dynamicAds
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

// ==================== ACCOUNT MANAGEMENT ENDPOINTS ====================

// Check if username exists (for forgot password)
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const admin = await Admin.findOne({ username });
    
    if (!admin) {
      return res.status(404).json({ error: 'Username not found' });
    }

    // Check if admin has recovery codes available
    const hasRecoveryCodes = admin.recoveryCodes && admin.recoveryCodes.some(c => !c.used);

    res.json({ 
      exists: true,
      hasRecoveryCodes
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// Verify recovery code
router.post('/verify-recovery-code', async (req, res) => {
  try {
    const { username, code } = req.body;
    
    if (!username || !code) {
      return res.status(400).json({ error: 'Username and recovery code are required' });
    }

    const admin = await Admin.findOne({ username });
    
    if (!admin) {
      return res.status(404).json({ error: 'Username not found' });
    }

    const isValid = admin.verifyRecoveryCode(code);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or already used recovery code' });
    }

    await admin.save();

    // Generate a temporary reset token (valid for 10 minutes)
    const resetToken = jwt.sign(
      { adminId: admin._id, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '10m' }
    );

    res.json({ 
      success: true,
      resetToken,
      message: 'Recovery code verified' 
    });
  } catch (error) {
    console.error('Verify recovery code error:', error);
    res.status(500).json({ error: 'Failed to verify recovery code' });
  }
});

// Reset password (using reset token from security question or recovery code)
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(401).json({ error: 'Invalid token purpose' });
    }

    const admin = await Admin.findById(decoded.adminId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    admin.password = newPassword;
    admin.lastPasswordChange = new Date();
    await admin.save();

    res.json({ 
      success: true,
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Change password (when logged in)
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const admin = await Admin.findById(req.adminId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    admin.password = newPassword;
    admin.lastPasswordChange = new Date();
    await admin.save();

    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Change username (when logged in)
router.post('/change-username', verifyToken, async (req, res) => {
  try {
    const { newUsername, password } = req.body;
    
    if (!newUsername || !password) {
      return res.status(400).json({ error: 'New username and password are required' });
    }

    if (newUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    const admin = await Admin.findById(req.adminId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Check if username already exists
    const existingAdmin = await Admin.findOne({ username: newUsername });
    if (existingAdmin && existingAdmin._id.toString() !== admin._id.toString()) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    admin.username = newUsername;
    await admin.save();

    res.json({ 
      success: true,
      username: newUsername,
      message: 'Username changed successfully' 
    });
  } catch (error) {
    console.error('Change username error:', error);
    res.status(500).json({ error: 'Failed to change username' });
  }
});


// Generate recovery codes (when logged in)
router.post('/generate-recovery-codes', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const admin = await Admin.findById(req.adminId);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Verify password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    const codes = admin.generateRecoveryCodes(5);
    await admin.save();

    res.json({ 
      success: true,
      codes,
      message: 'Recovery codes generated successfully. Save these codes in a safe place!' 
    });
  } catch (error) {
    console.error('Generate recovery codes error:', error);
    res.status(500).json({ error: 'Failed to generate recovery codes' });
  }
});

// Get account info (when logged in)
router.get('/account-info', verifyToken, async (req, res) => {
  try {
    const admin = await Admin.findById(req.adminId).select('-password');
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const unusedRecoveryCodes = admin.recoveryCodes 
      ? admin.recoveryCodes.filter(c => !c.used).length 
      : 0;

    res.json({ 
      username: admin.username,
      unusedRecoveryCodes,
      lastPasswordChange: admin.lastPasswordChange,
      createdAt: admin.createdAt
    });
  } catch (error) {
    console.error('Get account info error:', error);
    res.status(500).json({ error: 'Failed to get account info' });
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
          cloudinaryUrl: adSettings[adKey].cloudinaryUrl !== undefined ? adSettings[adKey].cloudinaryUrl : (newImageUrl !== oldImageUrl ? '' : settings.ads[adKey].cloudinaryUrl || ''),
          clickUrl: adSettings[adKey].clickUrl || ''
        };
        
        // Check if image URL changed and needs uploading to Cloudinary
        if (newImageUrl && newImageUrl !== oldImageUrl && !settings.ads[adKey].cloudinaryUrl) {
          adsToUpload.push({ adKey, imageUrl: newImageUrl });
        }
      }
    });
    
    await settings.save();
    
            // Start background uploads to Storj for new images
        if (adsToUpload.length > 0) {
          console.log(`Starting background Storj upload for ${adsToUpload.length} ads`);
          adsToUpload.forEach(({ adKey, imageUrl }) => {
            uploadImageToStorj(adKey, imageUrl, settings._id);
          });
        }
    
    res.json(settings.ads);
  } catch (error) {
    console.error('Error updating ads settings:', error);
    res.status(500).json({ error: 'Failed to update ads settings' });
  }
});

// Background image upload to Storj function
async function uploadImageToStorj(adKey, imageUrl, settingsId, req = null) {
  try {
    console.log(`[Background] Starting Storj upload for ${adKey}: ${imageUrl}`);
    
    // Upload to Storj using the service (pass request for dynamic URL generation)
    const result = await storjService.uploadGifFromUrl(imageUrl, adKey, req);
    
    console.log(`[Background Storj] Successfully uploaded ${adKey}: ${result.displayUrl}`);
    
    // Update the database with Storj URL
    const settings = await SiteSettings.findById(settingsId);
    if (settings && settings.ads[adKey]) {
      settings.ads[adKey].cloudinaryUrl = result.displayUrl;
      await settings.save();
      console.log(`[Background] Successfully uploaded to Storj and updated ${adKey}: ${settings.ads[adKey].cloudinaryUrl}`);
    }
    
  } catch (error) {
    console.error(`[Background] Error uploading image to Storj for ${adKey}:`, error);
    // No fallback - Storj upload failed, log the error
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
    
    console.log(`[Manual Upload] Starting Storj upload for ${adKey}: ${imageUrl}`);
    
    // Upload to Storj using the service (pass request for dynamic URL generation)
    const result = await storjService.uploadGifFromUrl(imageUrl, adKey, req);
    
    console.log(`[Storj] Successfully uploaded ${adKey}: ${result.displayUrl}`);
    
    // Update the ad setting with Storj URL
    settings.ads[adKey].cloudinaryUrl = result.displayUrl;
    await settings.save();
    
    res.json({ 
      success: true, 
      cloudinaryUrl: settings.ads[adKey].cloudinaryUrl,
      message: 'Image uploaded to Storj successfully' 
    });
    
  } catch (error) {
    console.error('Error uploading ad image to Storj:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload image to Storj';
    if (error.response?.status === 404) {
      errorMessage = 'Image not found at the provided URL';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Could not reach the image URL';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out while downloading image';
    } else if (error.response?.status === 400) {
      errorMessage = 'Invalid image format or file too large';
    } else if (error.response?.status === 401) {
      errorMessage = 'Storj authentication failed - please check your Storj credentials in .env file';
    } else if (error.response?.status === 403) {
      errorMessage = 'Storj API access denied - check permissions and API quota';
    } else if (error.response?.status === 429) {
      errorMessage = 'Storj API rate limit exceeded. Please try again later.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Storj proxy endpoint - serves images from Storj using our credentials
router.get('/storj-proxy/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    console.log(`[Storj Proxy] Serving file: ${filename}`);
    
    // Get the file from Storj using our credentials
    const params = {
      Bucket: 'cinema-ads',
      Key: filename
    };
    
    // Get the file stream from Storj
    const fileStream = storjService.s3.getObject(params).createReadStream();
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS
    
    // Pipe the file stream to the response
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error(`[Storj Proxy] Error serving ${filename}:`, error.message);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });
    
  } catch (error) {
    console.error(`[Storj Proxy] Error:`, error.message);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Note: Local image serving endpoint removed - using Storj only

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

// ==================== AD CLICK TRACKING ENDPOINTS ====================

// Public endpoint to track ad clicks
router.post('/public/track-ad-click', async (req, res) => {
  try {
    const {
      adKey,
      clickUrl,
      pageUrl,
      sessionId,
      deviceType,
      browser,
      os
    } = req.body;

    // Validate required fields
    if (!adKey || !clickUrl || !pageUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
                     (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                     req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = req.headers.referer || req.headers.referrer || '';

    // Generate session ID if not provided
    const finalSessionId = sessionId || uuidv4();

    // Create ad click record
    const adClick = new AdClick({
      adKey,
      clickUrl,
      userAgent,
      ipAddress: ipAddress.split(',')[0].trim(), // Get first IP if multiple
      referrer,
      sessionId: finalSessionId,
      pageUrl,
      deviceType: deviceType || 'desktop',
      browser: browser || 'unknown',
      os: os || 'unknown'
    });

    await adClick.save();

    console.log(`[AdClick] Tracked click for ad: ${adKey}, session: ${finalSessionId}`);

    res.json({ 
      success: true, 
      sessionId: finalSessionId,
      message: 'Ad click tracked successfully' 
    });

  } catch (error) {
    console.error('Error tracking ad click:', error);
    res.status(500).json({ error: 'Failed to track ad click' });
  }
});

// Admin endpoint to get ad click statistics
router.get('/admin/ad-analytics', verifyToken, async (req, res) => {
  try {
    const { adKey, startDate, endDate, days = 30 } = req.query;

    // Get click statistics
    const stats = await AdClick.getClickStats(adKey, startDate, endDate);
    
    // Get daily trends
    const trends = await AdClick.getDailyTrends(adKey, parseInt(days));

    // Get recent clicks (last 50)
    const recentClicks = await AdClick.find(
      adKey ? { adKey } : {},
      null,
      { sort: { timestamp: -1 }, limit: 50 }
    ).select('adKey clickUrl timestamp ipAddress deviceType browser country city sessionId');

    // Get total unique sessions across all ads
    const totalUniqueSessions = await AdClick.distinct('sessionId', 
      adKey ? { adKey } : {}
    );

    // Get total configured ads from site settings
    const siteSettings = await SiteSettings.findOne();
    const configuredAds = siteSettings ? Object.keys(siteSettings.ads || {}) : [];
    const enabledAds = configuredAds.filter(adKey => siteSettings.ads[adKey]?.enabled);

    res.json({
      stats,
      trends,
      recentClicks,
      totalUniqueSessions: totalUniqueSessions.length,
      totalConfiguredAds: configuredAds.length,
      totalEnabledAds: enabledAds.length
    });

  } catch (error) {
    console.error('Error fetching ad analytics:', error);
    res.status(500).json({ error: 'Failed to fetch ad analytics' });
  }
});

// Admin endpoint to get ad click summary
router.get('/admin/ad-summary', verifyToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get total clicks in period
    const totalClicks = await AdClick.countDocuments({
      timestamp: { $gte: startDate }
    });

    // Get unique sessions in period
    const uniqueSessions = await AdClick.distinct('sessionId', {
      timestamp: { $gte: startDate }
    });

    // Get clicks by ad
    const clicksByAd = await AdClick.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$adKey',
          clicks: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          adKey: '$_id',
          clicks: 1,
          uniqueSessions: { $size: '$uniqueSessions' }
        }
      },
      { $sort: { clicks: -1 } }
    ]);

    // Get device breakdown
    const deviceBreakdown = await AdClick.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$deviceType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      period: `${days} days`,
      totalClicks,
      uniqueSessions: uniqueSessions.length,
      clicksByAd,
      deviceBreakdown
    });

  } catch (error) {
    console.error('Error fetching ad summary:', error);
    res.status(500).json({ error: 'Failed to fetch ad summary' });
  }
});

// Admin endpoint to export ad click data
router.get('/admin/export-ad-data', verifyToken, async (req, res) => {
  try {
    const { adKey, startDate, endDate, format = 'json' } = req.query;

    const matchStage = {};
    if (adKey) matchStage.adKey = adKey;
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    const clicks = await AdClick.find(matchStage)
      .sort({ timestamp: -1 })
      .select('adKey clickUrl timestamp ipAddress deviceType browser os country city sessionId pageUrl referrer');

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'Ad Key,Click URL,Timestamp,IP Address,Device Type,Browser,OS,Country,City,Session ID,Page URL,Referrer\n';
      const csvData = clicks.map(click => 
        `"${click.adKey}","${click.clickUrl}","${click.timestamp}","${click.ipAddress}","${click.deviceType}","${click.browser}","${click.os}","${click.country}","${click.city}","${click.sessionId}","${click.pageUrl}","${click.referrer}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ad-clicks-${Date.now()}.csv"`);
      res.send(csvHeader + csvData);
    } else {
      res.json(clicks);
    }

  } catch (error) {
    console.error('Error exporting ad data:', error);
    res.status(500).json({ error: 'Failed to export ad data' });
  }
});

module.exports = router; 