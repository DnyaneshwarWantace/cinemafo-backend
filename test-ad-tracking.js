const mongoose = require('mongoose');
const AdClick = require('./models/AdClick');

// Test script for ad click tracking
async function testAdTracking() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cinema-fo-stream');
    console.log('Connected to MongoDB');

    // Test creating an ad click record
    const testAdClick = new AdClick({
      adKey: 'mainPageAd1',
      clickUrl: 'https://example.com/test-ad',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: '127.0.0.1',
      referrer: 'https://cinema-fo.com/',
      sessionId: 'test-session-123',
      pageUrl: 'https://cinema-fo.com/',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'Windows'
    });

    await testAdClick.save();
    console.log('✅ Test ad click record created successfully');

    // Test getting click statistics
    const stats = await AdClick.getClickStats();
    console.log('✅ Click statistics:', stats);

    // Test getting daily trends
    const trends = await AdClick.getDailyTrends(null, 7);
    console.log('✅ Daily trends:', trends);

    // Test counting total clicks
    const totalClicks = await AdClick.countDocuments();
    console.log('✅ Total clicks in database:', totalClicks);

    // Test finding recent clicks
    const recentClicks = await AdClick.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .select('adKey clickUrl timestamp deviceType browser');
    console.log('✅ Recent clicks:', recentClicks);

    console.log('\n🎉 All ad tracking tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testAdTracking();
