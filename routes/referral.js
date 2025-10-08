const express = require('express');
const router = express.Router();
const Referral = require('../models/Referral');
const jwt = require('jsonwebtoken');

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Public route to handle referral redirects
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    
    // Find the referral code
    const referral = await Referral.findOne({ 
      code: code.toUpperCase(), 
      isActive: true 
    });
    
    if (!referral) {
      // If referral code doesn't exist, redirect to home
      return res.redirect('/');
    }
    
    // Track the visit
    await referral.trackVisit(ip, userAgent, '/');
    
    // Set a cookie to track this user for conversion tracking
    res.cookie('referral_source', code, { 
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false, // Allow frontend to read it
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Redirect to frontend home page
    const frontendUrl = process.env.FRONTEND_URL || 'https://cinema.fo';
    res.redirect(frontendUrl);
    
  } catch (error) {
    console.error('Referral redirect error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://cinema.fo';
    res.redirect(frontendUrl);
  }
});

// Admin routes (protected)

// Get all referral links
router.get('/admin/list', verifyAdminToken, async (req, res) => {
  try {
    const referrals = await Referral.find()
      .sort({ createdAt: -1 })
      .select('-pageViews -uniqueVisitors'); // Exclude large arrays for list view
    
    res.json({ referrals });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referral links' });
  }
});

// Get detailed stats for a specific referral
router.get('/admin/stats/:id', verifyAdminToken, async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    // Calculate additional stats
    const stats = {
      ...referral.toObject(),
      conversionRate: referral.visits > 0 ? (referral.conversions / referral.visits * 100).toFixed(2) : 0,
      averageVisitsPerUser: referral.uniqueVisits > 0 ? (referral.visits / referral.uniqueVisits).toFixed(2) : 0,
      recentPageViews: referral.pageViews.slice(-10), // Last 10 page views
      topPages: getTopPages(referral.pageViews)
    };
    
    res.json({ referral: stats });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

// Get overall referral stats
router.get('/admin/overview', verifyAdminToken, async (req, res) => {
  try {
    const stats = await Referral.getStats();
    const topReferrals = await Referral.find({ isActive: true })
      .sort({ visits: -1 })
      .limit(10)
      .select('code name visits uniqueVisits conversions');
    
    res.json({ 
      overview: stats[0] || {
        totalReferrals: 0,
        totalVisits: 0,
        totalUniqueVisits: 0,
        totalConversions: 0,
        activeReferrals: 0
      },
      topReferrals
    });
  } catch (error) {
    console.error('Error fetching referral overview:', error);
    res.status(500).json({ error: 'Failed to fetch referral overview' });
  }
});

// Create new referral link
router.post('/admin/create', verifyAdminToken, async (req, res) => {
  try {
    const { name, description, campaign, source, code } = req.body;
    
    // Generate code if not provided
    let referralCode = code;
    if (!referralCode) {
      // Generate a random code
      referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    // Check if code already exists
    const existingReferral = await Referral.findOne({ code: referralCode.toUpperCase() });
    if (existingReferral) {
      return res.status(400).json({ error: 'Referral code already exists' });
    }
    
    const referral = new Referral({
      code: referralCode.toUpperCase(),
      name,
      description,
      campaign,
      source
    });
    
    await referral.save();
    
    res.status(201).json({ 
      referral,
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/${referralCode.toLowerCase()}`
    });
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({ error: 'Failed to create referral link' });
  }
});

// Update referral link
router.put('/admin/update/:id', verifyAdminToken, async (req, res) => {
  try {
    const { name, description, campaign, source, isActive } = req.body;
    
    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { name, description, campaign, source, isActive },
      { new: true, runValidators: true }
    );
    
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    res.json({ referral });
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({ error: 'Failed to update referral link' });
  }
});

// Delete referral link
router.delete('/admin/delete/:id', verifyAdminToken, async (req, res) => {
  try {
    const referral = await Referral.findByIdAndDelete(req.params.id);
    
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    res.json({ message: 'Referral link deleted successfully' });
  } catch (error) {
    console.error('Error deleting referral:', error);
    res.status(500).json({ error: 'Failed to delete referral link' });
  }
});

// Track conversion (called by frontend when user actually uses the site)
router.post('/track-conversion', async (req, res) => {
  try {
    const { referralCode } = req.body;
    
    if (!referralCode) {
      return res.status(400).json({ error: 'Referral code required' });
    }
    
    const referral = await Referral.findOne({ 
      code: referralCode.toUpperCase(),
      isActive: true 
    });
    
    if (referral) {
      await referral.trackConversion();
      res.json({ message: 'Conversion tracked successfully' });
    } else {
      res.status(404).json({ error: 'Referral not found' });
    }
  } catch (error) {
    console.error('Error tracking conversion:', error);
    res.status(500).json({ error: 'Failed to track conversion' });
  }
});

// Helper function to get top pages
function getTopPages(pageViews) {
  const pageCount = {};
  pageViews.forEach(view => {
    pageCount[view.page] = (pageCount[view.page] || 0) + 1;
  });
  
  return Object.entries(pageCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([page, count]) => ({ page, count }));
}

module.exports = router;
