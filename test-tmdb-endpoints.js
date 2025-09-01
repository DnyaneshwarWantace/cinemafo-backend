const axios = require('axios');

// Test the TMDB API endpoints directly
async function testTMDBEndpoints() {
  const apiKeys = [
    '2e6638415afa4bed294d51c00719a281',
    '805f3926d552d5e54d292baf2336242d',
    'your_original_api_key_here' // Replace with your original key
  ];
  
  const baseURL = 'https://api.themoviedb.org/3';
  
  const endpoints = [
    '/movie/top_rated',
    '/movie/top_rated', 
    '/tv/top_rated',
    '/tv/top_rated',
    '/movie/now_playing',
    '/movie/now_playing'
  ];
  
  console.log('🧪 Testing TMDB API endpoints...\n');
  
  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${endpoint}`);
    
    for (let i = 0; i < apiKeys.length; i++) {
      const apiKey = apiKeys[i];
      console.log(`  🔑 Using API key ${i + 1}: ${apiKey.substring(0, 8)}...`);
      
      try {
        const response = await axios.get(`${baseURL}${endpoint}`, {
          params: {
            api_key: apiKey,
            language: 'en-US'
          },
          timeout: 10000
        });
        
        console.log(`  ✅ SUCCESS! Status: ${response.status}`);
        console.log(`  📊 Results count: ${response.data.results?.length || 0}`);
        break; // If successful, move to next endpoint
        
      } catch (error) {
        console.log(`  ❌ FAILED: ${error.response?.status || error.code} - ${error.response?.data?.status_message || error.message}`);
        
        if (error.response?.status === 401) {
          console.log(`  🔐 API key ${i + 1} is invalid`);
        } else if (error.response?.status === 404) {
          console.log(`  🚫 Endpoint ${endpoint} not found`);
        }
      }
      
      // Wait a bit between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Run the test
testTMDBEndpoints().catch(console.error);






