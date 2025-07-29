const axios = require('axios');

const MOVIE_ID = '1061474';
const BASE_URL = 'https://cinemafo.lol/api';

async function testMovie1234821() {
  console.log(`🧪 Testing Movie ID: ${MOVIE_ID}\n`);

  // Test 1: Direct Nigflix checker
  console.log('1️⃣ Testing Nigflix Checker Directly:');
  try {
    const checkerResponse = await axios.head(`http://checker.niggaflix.xyz/verify/movie/${MOVIE_ID}`);
    console.log('✅ Nigflix checker is working:', checkerResponse.status);
    console.log('✅ Movie is available on Nigflix!');
  } catch (error) {
    console.log('❌ Nigflix checker failed:', error.response?.status || error.message);
    if (error.response?.status === 404) {
      console.log('❌ Movie not found on Nigflix');
    }
  }

  // Test 2: Backend stream endpoint (if server is running)
  console.log('\n2️⃣ Testing Backend Stream Endpoint:');
  try {
    const streamResponse = await axios.get(`${BASE_URL}/stream/movie/${MOVIE_ID}`);
    console.log('✅ Backend stream endpoint response:', {
      status: streamResponse.status,
      url: streamResponse.data.stream?.url,
      type: streamResponse.data.stream?.type
    });
  } catch (error) {
    console.log('❌ Backend stream endpoint failed:', error.response?.status || error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Backend server is not running. Start it with: npm start');
    }
  }

  // Test 3: Official endpoint
  console.log('\n3️⃣ Testing Official Endpoint:');
  try {
    const officialResponse = await axios.get(`${BASE_URL}/official/movie/${MOVIE_ID}`);
    console.log('✅ Official endpoint response:', {
      status: officialResponse.status,
      url: officialResponse.data.stream?.url
    });
  } catch (error) {
    console.log('❌ Official endpoint failed:', error.response?.status || error.message);
  }

  // Test 4: Nigflix endpoint
  console.log('\n4️⃣ Testing Nigflix Endpoint:');
  try {
    const nigflixResponse = await axios.get(`${BASE_URL}/niggaflix/movie/${MOVIE_ID}`);
    console.log('✅ Nigflix endpoint response:', {
      status: nigflixResponse.status,
      url: nigflixResponse.data.stream?.url
    });
  } catch (error) {
    console.log('❌ Nigflix endpoint failed:', error.response?.status || error.message);
  }

  // Test 5: TMDB movie details
  console.log('\n5️⃣ Testing TMDB Movie Details:');
  try {
    const tmdbResponse = await axios.get(`${BASE_URL}/movies/${MOVIE_ID}`);
    console.log('✅ TMDB movie details:', {
      status: tmdbResponse.status,
      title: tmdbResponse.data.title,
      release_date: tmdbResponse.data.release_date,
      overview: tmdbResponse.data.overview?.substring(0, 100) + '...'
    });
  } catch (error) {
    console.log('❌ TMDB movie details failed:', error.response?.status || error.message);
  }

  console.log('\n🎬 Test Summary for Movie ID 1061474:');
  console.log('- Nigflix checker should verify content availability');
  console.log('- Backend endpoints should return stream URLs');
  console.log('- TMDB should provide movie metadata');
}

// Run the test
testMovie1234821().catch(console.error); 