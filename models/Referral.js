const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  campaign: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    trim: true // e.g., "facebook", "instagram", "google", "youtube", etc.
  },
  visits: {
    type: Number,
    default: 0
  },
  uniqueVisits: {
    type: Number,
    default: 0
  },
  conversions: {
    type: Number,
    default: 0 // Number of users who actually used the site after clicking
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date
  },
  // Track which pages users visit after clicking the referral
  pageViews: [{
    page: String,
    timestamp: { type: Date, default: Date.now },
    userAgent: String,
    ip: String
  }],
  // Track unique visitors by IP
  uniqueVisitors: [{
    ip: String,
    userAgent: String,
    firstVisit: { type: Date, default: Date.now },
    lastVisit: { type: Date, default: Date.now },
    visitCount: { type: Number, default: 1 }
  }]
}, {
  timestamps: true
});

// Index for faster lookups
referralSchema.index({ code: 1 });
referralSchema.index({ isActive: 1 });
referralSchema.index({ createdAt: -1 });

// Method to track a visit
referralSchema.methods.trackVisit = function(ip, userAgent, page = '/') {
  this.visits += 1;
  this.lastUsed = new Date();
  
  // Add page view
  this.pageViews.push({
    page,
    timestamp: new Date(),
    userAgent,
    ip
  });
  
  // Check if this is a unique visitor
  const existingVisitor = this.uniqueVisitors.find(visitor => visitor.ip === ip);
  if (existingVisitor) {
    existingVisitor.lastVisit = new Date();
    existingVisitor.visitCount += 1;
  } else {
    this.uniqueVisitors.push({
      ip,
      userAgent,
      firstVisit: new Date(),
      lastVisit: new Date(),
      visitCount: 1
    });
    this.uniqueVisits += 1;
  }
  
  return this.save();
};

// Method to track conversion (when user actually uses the site)
referralSchema.methods.trackConversion = function() {
  this.conversions += 1;
  return this.save();
};

// Static method to get referral stats
referralSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        totalVisits: { $sum: '$visits' },
        totalUniqueVisits: { $sum: '$uniqueVisits' },
        totalConversions: { $sum: '$conversions' },
        activeReferrals: {
          $sum: {
            $cond: [{ $eq: ['$isActive', true] }, 1, 0]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Referral', referralSchema);
