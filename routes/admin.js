const express = require('express');
const router = express.Router();
const SiteSettings = require('../models/SiteSettings');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');

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
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
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

// Update content settings
router.put('/settings/content', verifyToken, async (req, res) => {
  try {
    const { disclaimer, aboutUs, socialLinks } = req.body;
    
    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }
    
    settings.content = {
      ...settings.content,
      disclaimer: disclaimer || '',
      aboutUs: aboutUs || ''
    };
    
    // Update social links in floatingSocialButtons if provided
    if (socialLinks) {
      settings.appearance.floatingSocialButtons = {
        ...settings.appearance.floatingSocialButtons,
        discordUrl: socialLinks.discord || '',
        telegramUrl: socialLinks.telegram || ''
      };
    }
    
    await settings.save();
    res.json(settings.content);
  } catch (error) {
    console.error('Error updating content settings:', error);
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
    
    // Update each ad setting
    Object.keys(adSettings).forEach(adKey => {
      if (settings.ads[adKey]) {
        settings.ads[adKey] = {
          enabled: adSettings[adKey].enabled || false,
          imageUrl: adSettings[adKey].imageUrl || '',
          clickUrl: adSettings[adKey].clickUrl || ''
        };
      }
    });
    
    await settings.save();
    res.json(settings.ads);
  } catch (error) {
    console.error('Error updating ads settings:', error);
    res.status(500).json({ error: 'Failed to update ads settings' });
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