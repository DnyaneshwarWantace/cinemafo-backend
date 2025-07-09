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
        socialLinks: settings.content.socialLinks
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

// Appearance Settings
router.put('/settings/appearance', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});
    
    settings.appearance = {
      ...settings.appearance,
      ...updates
    };
    await settings.save();
    res.json(settings.appearance);
  } catch (error) {
    console.error('Error updating appearance settings:', error);
    res.status(500).json({ error: 'Failed to update appearance settings' });
  }
});

// Announcement Bar Settings (legacy)
router.put('/settings/announcement', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});
    
    settings.appearance.announcementBar = {
      ...settings.appearance.announcementBar,
      ...updates
    };
    await settings.save();
    res.json(settings.appearance.announcementBar);
  } catch (error) {
    console.error('Error updating announcement settings:', error);
    res.status(500).json({ error: 'Failed to update announcement settings' });
  }
});

// Social Buttons Settings (legacy)
router.put('/settings/social-buttons', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});
    
    settings.appearance.floatingSocialButtons = {
      ...settings.appearance.floatingSocialButtons,
      ...updates
    };
    await settings.save();
    res.json(settings.appearance.floatingSocialButtons);
  } catch (error) {
    console.error('Error updating social buttons settings:', error);
    res.status(500).json({ error: 'Failed to update social buttons settings' });
  }
});

// Content Settings
router.put('/settings/content', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});
    
    settings.content = {
      ...settings.content,
      ...updates
    };
    await settings.save();
    res.json(settings.content);
  } catch (error) {
    console.error('Error updating content settings:', error);
    res.status(500).json({ error: 'Failed to update content settings' });
  }
});

// Ad Settings
router.put('/settings/ads', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});
    
    settings.ads = {
      ...settings.ads,
      ...updates
    };
    await settings.save();
    res.json(settings.ads);
  } catch (error) {
    console.error('Error updating ad settings:', error);
    res.status(500).json({ error: 'Failed to update ad settings' });
  }
});

// Update site settings
router.put('/settings', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    let settings = await SiteSettings.findOne();
    
    if (!settings) {
      settings = await SiteSettings.create(updates);
    } else {
      settings.appearance = { ...settings.appearance, ...updates.appearance };
      settings.content = { ...settings.content, ...updates.content };
      settings.ads = { ...settings.ads, ...updates.ads };
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating site settings:', error);
    res.status(500).json({ error: 'Failed to update site settings' });
  }
});

module.exports = router; 