const axios = require('axios');

// Test the backend endpoints
async function testBackendEndpoints() {
  const baseURL = 'https://cinemafo.lol';
  
  const endpoints = [
    '/api/movies/top_rated',
    '/api/tv/top_rated',
    '/api/movies/now_playing'
  ];
  
  console.log('🧪 Testing Backend Endpoints...\n');
  
  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${endpoint}`);
    
    try {
      const response = await axios.get(`${baseURL}${endpoint}`, {
        timeout: 30000
      });
      
      console.log(`  ✅ SUCCESS! Status: ${response.status}`);
      console.log(`  📊 Results count: ${response.data.results?.length || 0}`);
      
      if (response.data.results && response.data.results.length > 0) {
        console.log(`  🎬 First item: ${response.data.results[0].title || response.data.results[0].name}`);
      }
      
    } catch (error) {
      console.log(`  ❌ FAILED: ${error.response?.status || error.code} - ${error.response?.data?.error || error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log(`  🔌 Server not running. Please start the backend server first.`);
      }
    }
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run the test
testBackendEndpoints().catch(console.error);






