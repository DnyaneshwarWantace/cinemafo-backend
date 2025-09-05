const mongoose = require('mongoose');

const adClickSchema = new mongoose.Schema({
  adKey: {
    type: String,
    required: true,
    index: true
  },
  clickUrl: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  referrer: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  pageUrl: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop'],
    default: 'desktop'
  },
  browser: {
    type: String,
    default: 'unknown'
  },
  os: {
    type: String,
    default: 'unknown'
  },
  country: {
    type: String,
    default: 'unknown'
  },
  city: {
    type: String,
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Index for efficient queries
adClickSchema.index({ adKey: 1, timestamp: -1 });
adClickSchema.index({ timestamp: -1 });
adClickSchema.index({ sessionId: 1, adKey: 1 });

// Static method to get click statistics
adClickSchema.statics.getClickStats = async function(adKey = null, startDate = null, endDate = null) {
  const matchStage = {};
  
  if (adKey) {
    matchStage.adKey = adKey;
  }
  
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$adKey',
        totalClicks: { $sum: 1 },
        uniqueSessions: { $addToSet: '$sessionId' },
        deviceTypes: { $addToSet: '$deviceType' },
        countries: { $addToSet: '$country' },
        browsers: { $addToSet: '$browser' },
        firstClick: { $min: '$timestamp' },
        lastClick: { $max: '$timestamp' }
      }
    },
    {
      $project: {
        adKey: '$_id',
        totalClicks: 1,
        uniqueSessions: { $size: '$uniqueSessions' },
        deviceTypes: 1,
        countries: 1,
        browsers: 1,
        firstClick: 1,
        lastClick: 1
      }
    },
    { $sort: { totalClicks: -1 } }
  ]);

  return stats;
};

// Static method to get daily click trends
adClickSchema.statics.getDailyTrends = async function(adKey = null, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage = {
    timestamp: { $gte: startDate }
  };
  
  if (adKey) {
    matchStage.adKey = adKey;
  }

  const trends = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          adKey: '$adKey',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          }
        },
        clicks: { $sum: 1 },
        uniqueSessions: { $addToSet: '$sessionId' }
      }
    },
    {
      $project: {
        adKey: '$_id.adKey',
        date: '$_id.date',
        clicks: 1,
        uniqueSessions: { $size: '$uniqueSessions' }
      }
    },
    { $sort: { date: 1 } }
  ]);

  return trends;
};

const AdClick = mongoose.model('AdClick', adClickSchema);

module.exports = AdClick;
