const StorjService = require('./storj-service.js');
require('dotenv').config();

async function testStorjConnection() {
  console.log('🧪 Testing Storj Connection...');
  
  const storjService = new StorjService();
  
  try {
    // Test connection
    const connectionTest = await storjService.testConnection();
    console.log('📊 Connection Test Result:', connectionTest);
    
    if (connectionTest.success) {
      console.log('✅ Storj connection successful!');
      
      // Test bucket creation
      console.log('🪣 Ensuring bucket exists...');
      await storjService.ensureBucketExists();
      console.log('✅ Bucket ready!');
      
      // Test upload with a sample image URL
      console.log('📤 Testing upload functionality...');
      const testImageUrl = 'https://via.placeholder.com/150x150.gif';
      
      const uploadResult = await storjService.uploadGifFromUrl(testImageUrl, 'test-ad');
      console.log('📊 Upload Test Result:', uploadResult);
      
      if (uploadResult.success) {
        console.log('✅ Upload test successful!');
        console.log('🔗 Test image URL:', uploadResult.displayUrl);
      } else {
        console.log('❌ Upload test failed');
      }
      
    } else {
      console.log('❌ Storj connection failed:', connectionTest.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testStorjConnection();
