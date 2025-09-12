const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const crypto = require('crypto');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}/api`;

// MongoDB Connection
mongoose.connect(process.env.DATABASE_URL).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// Cache configuration
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 1000; // Maximum number of cached items

// Cache helper functions
const getCacheKey = (url, params = {}) => {
  const paramString = Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
  return `${url}${paramString}`;
};
//cache helper function
const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 Cache HIT for ${key}`);
    return cached.data;
  }
  if (cached) {
    cache.delete(key); // Remove expired cache
  }
  return null;
};

const setCache = (key, data) => {
  // Implement LRU-like behavior
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`💾 Cache SET for ${key} (size: ${cache.size})`);
};

// Rate limiting: track last request time
let lastRequestTime = 0;
const REQUEST_DELAY = 100; // 100ms delay between requests (allows ~30 requests per second with 3 API keys)

// TMDB Configuration with API Key Rotation
const TMDB_API_KEYS = process.env.TMDB_API_KEYS 
  ? process.env.TMDB_API_KEYS.split(',').map(key => key.trim())
  : [];

let currentApiKeyIndex = 0;

const getNextApiKey = () => {
  if (TMDB_API_KEYS.length === 0) {
    throw new Error('No TMDB API keys configured. Please set TMDB_API_KEYS in your .env file');
  }
  const key = TMDB_API_KEYS[currentApiKeyIndex];
  console.log(`🔑 Using API key ${currentApiKeyIndex + 1}/${TMDB_API_KEYS.length} (${key.substring(0, 8)}...)`);
  currentApiKeyIndex = (currentApiKeyIndex + 1) % TMDB_API_KEYS.length;
  return key;
};

const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const VIDSRC_BASE_URL = process.env.VIDSRC_BASE_URL || 'https://vidsrc.xyz/embed';

// Encryption functions for niggaflix URLs
function encryptPath(path) {
    const key = 'methamphetamines';
    const iv = key.substring(0, 16);

    // Apply PKCS#7 padding
    const blockSize = 16;
    const inputBytes = Buffer.from(path);
    const paddingLength = blockSize - (inputBytes.length % blockSize);
    const paddedBytes = Buffer.alloc(inputBytes.length + paddingLength);
    inputBytes.copy(paddedBytes);
    for (let i = inputBytes.length; i < paddedBytes.length; i++) {
        paddedBytes[i] = paddingLength;
    }

    // Encrypt
    const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv));
    let encrypted = cipher.update(paddedBytes);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Convert to URL-safe Base64
    const base64 = encrypted.toString('base64');
    const urlSafeBase64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return urlSafeBase64;
}

function generateEncryptedUrl(type, id) {
    try {
        const encryptedId = encryptPath(id);
        const url = `https://cdn.niggaflix.xyz/${type}/${encryptedId}/index.m3u8`;
        console.log('Encrypted URL:', url);
        return url;
    } catch (error) {
        console.error('Encryption failed:', error);
        return null;
    }
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Enhanced TMDB API call with caching, retry logic, and API key rotation
async function fetchFromTMDB(endpoint, params = {}) {
  const cacheKey = getCacheKey(endpoint, params);
  
  // Check cache first
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const url = `${TMDB_BASE_URL}${endpoint}`;
  const config = {
    params: {
      api_key: getNextApiKey(), // Use rotating API key
      language: 'en-US',
      ...params
    },
    timeout: 10000
  };

  const maxRetries = 6;
  const baseDelay = 3000; // 3 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Rate limiting check
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      if (timeSinceLastRequest < REQUEST_DELAY) {
        const waitTime = REQUEST_DELAY - timeSinceLastRequest;
        console.log(`⏳ Rate limiting: waiting ${waitTime}ms before request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      lastRequestTime = Date.now();
      
      // Use different API key for each retry attempt
      if (attempt > 1) {
        config.params.api_key = getNextApiKey();
      }
      
      console.log(`🎬 TMDB API attempt ${attempt}/${maxRetries} for ${endpoint}`);
      const response = await axios.get(url, config);
      
      console.log(`✅ TMDB API success for ${endpoint} on attempt ${attempt}`);
      console.log(`📊 Response data: ${response.data?.results?.length || 0} items returned`);
      
      // Cache successful response
      setCache(cacheKey, response.data);
      return response.data;
      
    } catch (error) {
      const isRateLimit = error.response?.status === 429 || 
                         error.code === 'ECONNRESET' || 
                         error.code === 'ETIMEDOUT' ||
                         (error.response?.status >= 500 && error.response?.status < 600);

      if (isRateLimit && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(1.5, attempt - 1);
        console.log(`❌ TMDB API attempt ${attempt}/${maxRetries} failed for ${endpoint}: Rate limited or connection reset`);
        console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (attempt === maxRetries) {
        console.log(`❌ TMDB API attempt ${attempt}/${maxRetries} failed for ${endpoint}: ${error.message}`);
        console.log(`🔍 Error details:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          code: error.code
        });
        console.log(`🎭 Returning mock data for ${endpoint} due to API failure after ${maxRetries} attempts`);
        
        // Return mock data for critical endpoints
        const mockData = getMockDataForEndpoint(endpoint);
        if (mockData) {
          setCache(cacheKey, mockData);
          return mockData;
        }
        
        throw new Error(`TMDB API failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      console.log(`❌ TMDB API attempt ${attempt}/${maxRetries} failed for ${endpoint}: ${error.message}`);
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(1.5, attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// Mock data for when TMDB API is unavailable
const getMockDataForEndpoint = (endpoint) => {
  const mockMovie = {
    id: 1,
    title: "Sample Movie",
    name: "Sample Show",
    overview: "This is sample content while the API is unavailable.",
    poster_path: "/sample.jpg",
    backdrop_path: "/sample-backdrop.jpg",
    release_date: "2024-01-01",
    first_air_date: "2024-01-01",
    vote_average: 7.5,
    genres: [{ id: 1, name: "Action" }]
  };

  return {
    page: 1,
    results: Array(20).fill(mockMovie).map((item, index) => ({
      ...item,
      id: index + 1,
      title: `${item.title} ${index + 1}`,
      name: `${item.name} ${index + 1}`
    })),
    total_pages: 1,
    total_results: 20,
    genres: [
      { id: 28, name: "Action" },
      { id: 35, name: "Comedy" },
      { id: 18, name: "Drama" },
      { id: 27, name: "Horror" },
      { id: 878, name: "Science Fiction" }
    ]
  };
};

// Mock upcoming movies with future release dates
const getMockUpcomingMovies = () => {
  const futureDate = new Date();
  const upcomingMovies = [
    {
      id: 1001,
      title: "Avatar: The Way of Water 2",
      overview: "Jake Sully lives with his newfound family formed on the planet of Pandora. Once a familiar threat returns to finish what was previously started, Jake must work with Neytiri and the army of the Na'vi race to protect their planet.",
      poster_path: "/sample-upcoming1.jpg",
      backdrop_path: "/sample-upcoming1-backdrop.jpg",
      release_date: new Date(futureDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      vote_average: 8.2,
      genres: [{ id: 878, name: "Science Fiction" }, { id: 12, name: "Adventure" }]
    },
    {
      id: 1002,
      title: "The Batman 2",
      overview: "Batman ventures into Gotham City's underworld when a sadistic killer leaves behind a trail of cryptic clues. As the evidence begins to lead closer to home and the scale of the perpetrator's plans become clear, he must forge new relationships, unmask the culprit and bring justice to the abuse of power and corruption that has long plagued the metropolis.",
      poster_path: "/sample-upcoming2.jpg",
      backdrop_path: "/sample-upcoming2-backdrop.jpg",
      release_date: new Date(futureDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days from now
      vote_average: 8.8,
      genres: [{ id: 28, name: "Action" }, { id: 80, name: "Crime" }]
    },
    {
      id: 1003,
      title: "Spider-Man: Beyond the Spider-Verse",
      overview: "Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence. When the heroes clash on how to handle a new threat, Miles must redefine what it means to be a hero.",
      poster_path: "/sample-upcoming3.jpg",
      backdrop_path: "/sample-upcoming3-backdrop.jpg",
      release_date: new Date(futureDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
      vote_average: 9.1,
      genres: [{ id: 16, name: "Animation" }, { id: 28, name: "Action" }]
    },
    {
      id: 1004,
      title: "John Wick: Chapter 5",
      overview: "John Wick uncovers a path to defeating The High Table. But before he can earn his freedom, Wick must face off against a new enemy with powerful alliances across the globe and forces that turn old friends into foes.",
      poster_path: "/sample-upcoming4.jpg",
      backdrop_path: "/sample-upcoming4-backdrop.jpg",
      release_date: new Date(futureDate.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 120 days from now
      vote_average: 8.5,
      genres: [{ id: 28, name: "Action" }, { id: 53, name: "Thriller" }]
    },
    {
      id: 1005,
      title: "Dune: Part Three",
      overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the universe, he must prevent a terrible future only he can foresee.",
      poster_path: "/sample-upcoming5.jpg",
      backdrop_path: "/sample-upcoming5-backdrop.jpg",
      release_date: new Date(futureDate.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 180 days from now
      vote_average: 8.9,
      genres: [{ id: 878, name: "Science Fiction" }, { id: 18, name: "Drama" }]
    }
  ];

  return {
    page: 1,
    results: upcomingMovies,
    total_pages: 1,
    total_results: upcomingMovies.length,
    dates: {
      maximum: new Date(futureDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      minimum: new Date().toISOString().split('T')[0]
    }
  };
};

// Import routes
const adminRoutes = require('./routes/admin');
const referralRoutes = require('./routes/referral');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apiKeys: {
      total: TMDB_API_KEYS.length,
      currentIndex: currentApiKeyIndex,
      rotationEnabled: TMDB_API_KEYS.length > 0,
      configured: TMDB_API_KEYS.length > 0
    }
  });
});

// Admin routes
app.use('/api/admin', adminRoutes);

// Referral routes
app.use('/api/referral', referralRoutes);

// Direct referral redirect route (for short URLs)
app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    
    const Referral = require('./models/Referral');
    
    // Find the referral code
    const referral = await Referral.findOne({ 
      code: code.toUpperCase(), 
      isActive: true 
    });
    
    if (!referral) {
      // If referral code doesn't exist, redirect to home
      const frontendUrl = process.env.FRONTEND_URL || 'https://cinemafo.lol';
      return res.redirect(frontendUrl);
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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(frontendUrl);
    
  } catch (error) {
    console.error('Referral redirect error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(frontendUrl);
  }
});

// Test TMDB connectivity with API key rotation
app.get('/api/test-tmdb', async (req, res) => {
  try {
    if (TMDB_API_KEYS.length === 0) {
      return res.json({ 
        status: 'error', 
        message: 'No TMDB API keys configured',
        error: 'Please set TMDB_API_KEYS in your .env file',
        apiKeysCount: 0
      });
    }

    const response = await axios.get(`${TMDB_BASE_URL}/configuration`, {
      params: { api_key: getNextApiKey() },
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    res.json({ 
      status: 'success', 
      message: 'TMDB API is accessible with rotating keys',
      data: response.data,
      apiKeysCount: TMDB_API_KEYS.length
    });
  } catch (error) {
    res.json({ 
      status: 'error', 
      message: 'TMDB API is not accessible',
      error: error.message,
      code: error.code,
      apiKeysCount: TMDB_API_KEYS.length
    });
  }
});

// TMDB Endpoints

// Get trending movies with complete details
app.get('/api/movies/trending', async (req, res) => {
  try {
    const cacheKey = 'trending_movies_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/trending/movie/day');
    
    // Fetch complete details for each movie using append_to_response (single API call per movie)
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const movieDetails = await fetchFromTMDB(`/movie/${movie.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...movieDetails,
            cast: movieDetails.credits?.cast?.slice(0, 10) || [],
            crew: movieDetails.credits?.crew || [],
            keywords: movieDetails.keywords?.keywords || []
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error.message);
          return movie; // Return basic movie data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: moviesWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    res.status(500).json({ error: 'Failed to fetch trending movies' });
  }
});

// Get popular movies with complete details
app.get('/api/movies/popular', async (req, res) => {
  try {
    const cacheKey = 'popular_movies_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/movie/popular');
    
    // Fetch complete details for each movie using append_to_response (single API call per movie)
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const movieDetails = await fetchFromTMDB(`/movie/${movie.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...movieDetails,
            cast: movieDetails.credits?.cast?.slice(0, 10) || [],
            crew: movieDetails.credits?.crew || [],
            keywords: movieDetails.keywords?.keywords || []
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error.message);
          return movie; // Return basic movie data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: moviesWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    res.status(500).json({ error: 'Failed to fetch popular movies' });
  }
});

// Get movie details with cast, crew, and keywords
app.get('/api/movies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `movie_${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch movie details with credits and keywords in a single API call
    const movieDetails = await fetchFromTMDB(`/movie/${id}`, {
      append_to_response: 'credits,keywords'
    });

    // Combine all data
    const completeMovieData = {
      ...movieDetails,
      cast: movieDetails.credits?.cast || [],
      crew: movieDetails.credits?.crew || [],
      keywords: movieDetails.keywords?.keywords || []
    };

    setCache(cacheKey, completeMovieData);
    res.json(completeMovieData);
  } catch (error) {
    console.error('Error fetching movie details:', error);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// Get movies by genre with complete details
app.get('/api/movies/genre/:genreId', async (req, res) => {
  try {
    const { genreId } = req.params;
    const cacheKey = `movies_genre_${genreId}_complete`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/discover/movie', { with_genres: genreId });
    
    // Fetch complete details for each movie using append_to_response (single API call per movie)
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const movieDetails = await fetchFromTMDB(`/movie/${movie.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...movieDetails,
            cast: movieDetails.credits?.cast?.slice(0, 10) || [],
            crew: movieDetails.credits?.crew || [],
            keywords: movieDetails.keywords?.keywords || []
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error.message);
          return movie; // Return basic movie data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: moviesWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching movies by genre:', error);
    res.status(500).json({ error: 'Failed to fetch movies by genre' });
  }
});

// Get trending TV shows with complete details
app.get('/api/tv/trending', async (req, res) => {
  try {
    const cacheKey = 'trending_tv_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/trending/tv/day');
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching trending TV shows:', error);
    res.status(500).json({ error: 'Failed to fetch trending TV shows' });
  }
});

// Get popular TV shows with complete details
app.get('/api/tv/popular', async (req, res) => {
  try {
    const cacheKey = 'popular_tv_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/tv/popular');
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching popular TV shows:', error);
    res.status(500).json({ error: 'Failed to fetch popular TV shows' });
  }
});

// Get top rated TV shows with complete details
app.get('/api/tv/top_rated', async (req, res) => {
  try {
    console.log('📺 Fetching top rated TV shows...');
    const cacheKey = 'top_rated_tv_complete';
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log('✅ Returning cached top rated TV shows');
      return res.json(cached);
    }

    console.log('🌐 Fetching from TMDB API: /tv/top_rated');
    const data = await fetchFromTMDB('/tv/top_rated');
    console.log(`✅ TMDB API returned ${data.results?.length || 0} top rated TV shows`);
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching top rated TV shows:', error);
    res.status(500).json({ error: 'Failed to fetch top rated TV shows' });
  }
});

// Get TV shows by genre with complete details
app.get('/api/tv/genre/:genreId', async (req, res) => {
  try {
    const { genreId } = req.params;
    const cacheKey = `tv_genre_${genreId}_complete`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/discover/tv', { with_genres: genreId });
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching TV shows by genre:', error);
    res.status(500).json({ error: 'Failed to fetch TV shows by genre' });
  }
});

// Get TV show details with cast, crew, and keywords
app.get('/api/tv/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `tv_${id}_complete`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Fetch TV show details with credits and keywords in a single API call
    const showDetails = await fetchFromTMDB(`/tv/${id}`, {
      append_to_response: 'videos,similar,recommendations,credits,keywords'
    });

    // Combine all data
    const completeShowData = {
      ...showDetails,
      cast: showDetails.credits?.cast?.slice(0, 15) || [],
      crew: showDetails.credits?.crew || [],
      keywords: showDetails.keywords?.results || []
    };

    setCache(cacheKey, completeShowData);
    res.json(completeShowData);
  } catch (error) {
    console.error('Error fetching TV show details:', error);
    res.status(500).json({ error: 'Failed to fetch TV show details' });
  }
});

// Get TV show season details with episodes
app.get('/api/tv/:id/season/:seasonNumber', async (req, res) => {
  try {
    const { id, seasonNumber } = req.params;
    const cacheKey = `tv_${id}_season_${seasonNumber}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB(`/tv/${id}/season/${seasonNumber}`);
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching TV show season details:', error);
    // Return mock season data if API fails
    const mockSeason = {
      season_number: parseInt(seasonNumber),
      episodes: [
        { episode_number: 1, name: 'Episode 1', overview: 'First episode of the season' },
        { episode_number: 2, name: 'Episode 2', overview: 'Second episode of the season' },
        { episode_number: 3, name: 'Episode 3', overview: 'Third episode of the season' }
      ]
    };
    res.json(mockSeason);
  }
});

// Search content (movies and TV shows) with complete movie details
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Query parameter is required' });

    const cacheKey = `search_${query}_complete`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/search/multi', { query });
    
    // Fetch complete details for movie results in parallel
    const resultsWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (item) => {
        // Only fetch detailed data for movies
        if (item.media_type === 'movie') {
          try {
            const movieDetails = await fetchFromTMDB(`/movie/${item.id}`, {
              append_to_response: 'credits,keywords'
            });

            return {
              ...movieDetails,
              media_type: 'movie',
              cast: movieDetails.credits?.cast?.slice(0, 10) || [],
              crew: movieDetails.credits?.crew || [],
              keywords: movieDetails.keywords?.keywords || []
            };
          } catch (error) {
            console.error(`Error fetching details for movie ${item.id}:`, error.message);
            return item; // Return basic movie data if detailed fetch fails
          }
        } else {
          // Return TV shows and person results as-is
          return item;
        }
      })
    );

    const result = {
      ...data,
      results: resultsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'Failed to search content' });
  }
});

// Get movie genres
app.get('/api/genres/movie', async (req, res) => {
  try {
    const cacheKey = 'movie_genres';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/genre/movie/list');
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching movie genres:', error);
    const mockData = getMockData('/genre/movie/list');
    res.json(mockData);
  }
});

// Get TV genres
app.get('/api/genres/tv', async (req, res) => {
  try {
    const cacheKey = 'tv_genres';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/genre/tv/list');
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching TV genres:', error);
    const mockData = getMockData('/genre/tv/list');
    res.json(mockData);
  }
});

// Get top rated movies with complete details
app.get('/api/movies/top_rated', async (req, res) => {
  try {
    console.log('🎬 Fetching top rated movies...');
    const cacheKey = 'top_rated_movies_complete';
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log('✅ Returning cached top rated movies');
      return res.json(cached);
    }

    console.log('🌐 Fetching from TMDB API: /movie/top_rated');
    const data = await fetchFromTMDB('/movie/top_rated');
    console.log(`✅ TMDB API returned ${data.results?.length || 0} top rated movies`);
    
    // Fetch complete details for each movie using append_to_response (single API call per movie)
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const movieDetails = await fetchFromTMDB(`/movie/${movie.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...movieDetails,
            cast: movieDetails.credits?.cast?.slice(0, 10) || [],
            crew: movieDetails.credits?.crew || [],
            keywords: movieDetails.keywords?.keywords || []
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error.message);
          return movie; // Return basic movie data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: moviesWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching top rated movies:', error);
    res.status(500).json({ error: 'Failed to fetch top rated movies' });
  }
});

// Get upcoming movies with complete details
app.get('/api/movies/upcoming', async (req, res) => {
  try {
    const cacheKey = 'upcoming_movies_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/movie/upcoming');
    
    // Fetch complete details for each movie using append_to_response (single API call per movie)
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const movieDetails = await fetchFromTMDB(`/movie/${movie.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...movieDetails,
            cast: movieDetails.credits?.cast?.slice(0, 10) || [],
            crew: movieDetails.credits?.crew || [],
            keywords: movieDetails.keywords?.keywords || []
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error.message);
          return movie; // Return basic movie data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: moviesWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching upcoming movies:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming movies' });
  }
});

// Get now playing movies with complete details
app.get('/api/movies/now_playing', async (req, res) => {
  try {
    const cacheKey = 'now_playing_movies_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/movie/now_playing');
    
    // Fetch complete details for each movie using append_to_response (single API call per movie)
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const movieDetails = await fetchFromTMDB(`/movie/${movie.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...movieDetails,
            cast: movieDetails.credits?.cast?.slice(0, 10) || [],
            crew: movieDetails.credits?.crew || [],
            keywords: movieDetails.keywords?.keywords || []
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error.message);
          return movie; // Return basic movie data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: moviesWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching now playing movies:', error);
    res.status(500).json({ error: 'Failed to fetch now playing movies' });
  }
});



// Get available languages for content
app.get('/api/:type/:id/languages', async (req, res) => {
  try {
    const { type, id } = req.params;
    const cacheKey = `languages_${type}_${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Get content details to extract available languages
    const contentDetails = await fetchFromTMDB(`/${type}/${id}`);
    
    // Extract spoken languages and available translations
    const languages = contentDetails.spoken_languages || [];
    
    const result = {
      content_id: id,
      content_type: type,
      languages: languages.map(lang => ({
        iso_639_1: lang.iso_639_1,
        name: lang.name,
        english_name: lang.english_name || lang.name
      }))
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching available languages:', error);
    res.status(500).json({ error: 'Failed to fetch available languages' });
  }
});

// Streaming Routes

// Get movie stream URL with niggaflix checker and encrypted URL
app.get('/api/stream/movie/:id', async (req, res) => {
  const { id } = req.params;
  const checkUrl = `http://checker.niggaflix.xyz/verify/movie/${id}`;
  const finalUrl = generateEncryptedUrl('movie', id);

  try {
    // Perform a HEAD request to check if the file exists
    await axios.head(checkUrl, { timeout: 5000 }); // 5 second timeout
    // If the request is successful, return the stream URL
    res.json({ stream: { url: finalUrl } });
  } catch (error) {
    console.log(`Checker service timeout/error for movie ${id}:`, error.message);
    // If checker service is down, still return the URL (let the player handle it)
    res.json({ stream: { url: finalUrl } });
  }
});

// Get TV show stream URL with niggaflix checker and encrypted URL
app.get('/api/stream/tv/:id/:season/:episode', async (req, res) => {
  const { id, season, episode } = req.params;
  const checkUrl = `http://checker.niggaflix.xyz/verify/tv/${id}/${season}/${episode}`;
  const path = `${id}/${season}/${episode}`;
  const finalUrl = generateEncryptedUrl('tv', path);

  try {
    // Perform a HEAD request to check if the file exists
    await axios.head(checkUrl, { timeout: 5000 }); // 5 second timeout
    // If the request is successful, return the stream URL
    res.json({ stream: { url: finalUrl } });
  } catch (error) {
    console.log(`Checker service timeout/error for TV ${id}/${season}/${episode}:`, error.message);
    // If checker service is down, still return the URL (let the player handle it)
    res.json({ stream: { url: finalUrl } });
  }
});

// Note: Proxy endpoints removed as we now use encrypted niggaflix URLs directly new

// Official movie stream endpoint with encrypted URL
app.get("/api/official/movie/:tmdbid", async (req, res) => {
    const { tmdbid } = req.params;
    const path = tmdbid;
    const finalUrl = generateEncryptedUrl('movie', path); 
    const checkUrl = `http://checker.niggaflix.xyz/verify/movie/${tmdbid}`;

    try {
        // Perform a HEAD request to check if the file exists with timeout
        await axios.head(checkUrl, { timeout: 5000 }); // 5 second timeout
        // If the request is successful, return the stream URL
        res.json({ stream: { url: finalUrl } });
    } catch (error) {
        console.log(`Checker service timeout/error for movie ${tmdbid}:`, error.message);
        // If checker service is down, still return the URL (let the player handle it)
        res.json({ stream: { url: finalUrl } });
    }
});

// Official TV show stream endpoint with encrypted URL
app.get("/api/official/tv/:tmdbid/:season/:episode", async (req, res) => {
    const { tmdbid, season, episode } = req.params;
    const path = `${tmdbid}/${season}/${episode}`;
    const finalUrl = generateEncryptedUrl('tv', path); 
    const checkUrl = `http://checker.niggaflix.xyz/verify/tv/${tmdbid}/${season}/${episode}`;

    try {
        // Perform a HEAD request to check if the file exists
        await axios.head(checkUrl, { timeout: 5000 }); // 5 second timeout
        // If the request is successful, return the stream URL
        res.json({ stream: { url: finalUrl } });
    } catch (error) {
        console.log(`Checker service timeout/error for TV ${tmdbid}/${season}/${episode}:`, error.message);
        // If checker service is down, still return the URL (let the player handle it)
        res.json({ stream: { url: finalUrl } });
    }
});

// Niggaflix movie stream endpoint
app.get("/api/niggaflix/movie/:tmdbid", async (req, res) => {
    const { tmdbid } = req.params;
    const checkUrl = `http://checker.niggaflix.xyz/verify/movie/${tmdbid}`;
    const finalUrl = generateEncryptedUrl('movie', tmdbid);

    try {
        // Perform a HEAD request to check if the file exists
        await axios.head(checkUrl, { timeout: 5000 }); // 5 second timeout
        // If the request is successful, return the stream URL
        res.json({ stream: { url: finalUrl } });
    } catch (error) {
        console.log(`Checker service timeout/error for movie ${tmdbid}:`, error.message);
        // If checker service is down, still return the URL (let the player handle it)
        res.json({ stream: { url: finalUrl } });
    }
});

// Niggaflix TV show stream endpoint
app.get("/api/niggaflix/tv/:tmdbid/:season/:episode", async (req, res) => {
    const { tmdbid, season, episode } = req.params;
    const path = `${tmdbid}/${season}/${episode}`;
    const checkUrl = `http://checker.niggaflix.xyz/verify/tv/${tmdbid}/${season}/${episode}`;
    const finalUrl = generateEncryptedUrl('tv', path);

    try {
        // Perform a HEAD request to check if the file exists
        await axios.head(checkUrl, { timeout: 5000 }); // 5 second timeout
        // If the request is successful, return the stream URL
        res.json({ stream: { url: finalUrl } });
    } catch (error) {
        console.log(`Checker service timeout/error for TV ${tmdbid}/${season}/${episode}:`, error.message);
        // If checker service is down, still return the URL (let the player handle it)
        res.json({ stream: { url: finalUrl } });
    }
});

// Get web series (Netflix, Amazon Prime, etc.)
app.get('/api/tv/web-series', async (req, res) => {
  try {
    const cacheKey = 'web_series_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Get popular TV shows and filter for web series characteristics
    const data = await fetchFromTMDB('/tv/popular');
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 30).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching web series:', error);
    res.status(500).json({ error: 'Failed to fetch web series' });
  }
});

// Get crime dramas and thrillers
app.get('/api/tv/crime-dramas', async (req, res) => {
  try {
    const cacheKey = 'crime_dramas_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Get crime and thriller TV shows
    const data = await fetchFromTMDB('/discover/tv', { 
      with_genres: '80,9648', // Crime and Mystery
      sort_by: 'popularity.desc'
    });
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 25).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching crime dramas:', error);
    res.status(500).json({ error: 'Failed to fetch crime dramas' });
  }
});

// Get sci-fi and fantasy series
app.get('/api/tv/sci-fi-fantasy', async (req, res) => {
  try {
    const cacheKey = 'sci_fi_fantasy_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Get sci-fi and fantasy TV shows
    const data = await fetchFromTMDB('/discover/tv', { 
      with_genres: '10765,10759', // Sci-Fi & Fantasy, Action & Adventure
      sort_by: 'popularity.desc'
    });
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 25).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching sci-fi fantasy series:', error);
    res.status(500).json({ error: 'Failed to fetch sci-fi fantasy series' });
  }
});

// Get comedy series
app.get('/api/tv/comedy-series', async (req, res) => {
  try {
    const cacheKey = 'comedy_series_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    // Get comedy TV shows
    const data = await fetchFromTMDB('/discover/tv', { 
      with_genres: '35', // Comedy
      sort_by: 'popularity.desc'
    });
    
    // Fetch complete details for each show using append_to_response (single API call per show)
    const showsWithDetails = await Promise.all(
      data.results.slice(0, 25).map(async (show) => {
        try {
          const showDetails = await fetchFromTMDB(`/tv/${show.id}`, {
            append_to_response: 'credits,keywords'
          });

          return {
            ...showDetails,
            cast: showDetails.credits?.cast?.slice(0, 10) || [],
            crew: showDetails.credits?.crew || [],
            keywords: showDetails.keywords?.results || []
          };
        } catch (error) {
          console.error(`Error fetching details for TV show ${show.id}:`, error.message);
          return show; // Return basic show data if detailed fetch fails
        }
      })
    );

    const result = {
      ...data,
      results: showsWithDetails
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching comedy series:', error);
    res.status(500).json({ error: 'Failed to fetch comedy series' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Cinema Nexus Backend running on port ${PORT}`);
  console.log(`🔗 Health check: ${BACKEND_URL}/health`);
  console.log(`🔑 API Keys: ${TMDB_API_KEYS.length} keys configured for rotation`);
  if (TMDB_API_KEYS.length === 0) {
    console.log('⚠️  Warning: No API keys configured. Please set TMDB_API_KEYS in your .env file');
  }
  console.log('🚀 Backend ready to serve requests!');
}); 