const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}/api`;

// Cache configuration
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 1000; // Maximum number of cached items

// Cache helper functions
const getCacheKey = (url, params = {}) => {
  const paramString = Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
  return `${url}${paramString}`;
};

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
const REQUEST_DELAY = 500; // 500ms delay between requests to avoid rate limiting

// TMDB Configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY || '8265bd1679663a7ea12ac168da84d2e8';
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const STREAM_BASE_URL = process.env.STREAM_BASE_URL || 'https://mia.vidjoy.wtf';
const VIDSRC_BASE_URL = process.env.VIDSRC_BASE_URL || 'https://vidsrc.xyz/embed';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Enhanced TMDB API call with caching and retry logic
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
      api_key: TMDB_API_KEY,
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
      
      console.log(`🎬 TMDB API attempt ${attempt}/${maxRetries} for ${endpoint}`);
      const response = await axios.get(url, config);
      
      console.log(`✅ TMDB API success for ${endpoint} on attempt ${attempt}`);
      
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test TMDB connectivity
app.get('/api/test-tmdb', async (req, res) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/configuration`, {
      params: { api_key: TMDB_API_KEY },
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    res.json({ 
      status: 'success', 
      message: 'TMDB API is accessible',
      data: response.data 
    });
  } catch (error) {
    res.json({ 
      status: 'error', 
      message: 'TMDB API is not accessible',
      error: error.message,
      code: error.code 
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
    
    // Fetch complete details for each movie in parallel
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const [movieDetails, credits, keywords] = await Promise.all([
            fetchFromTMDB(`/movie/${movie.id}`),
            fetchFromTMDB(`/movie/${movie.id}/credits`),
            fetchFromTMDB(`/movie/${movie.id}/keywords`)
          ]);

          return {
            ...movieDetails,
            cast: credits.cast?.slice(0, 10) || [],
            crew: credits.crew || [],
            keywords: keywords.keywords || []
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
    
    // Fetch complete details for each movie in parallel
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const [movieDetails, credits, keywords] = await Promise.all([
            fetchFromTMDB(`/movie/${movie.id}`),
            fetchFromTMDB(`/movie/${movie.id}/credits`),
            fetchFromTMDB(`/movie/${movie.id}/keywords`)
          ]);

          return {
            ...movieDetails,
            cast: credits.cast?.slice(0, 10) || [],
            crew: credits.crew || [],
            keywords: keywords.keywords || []
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

    // Fetch movie details, credits, and keywords in parallel
    const [movieDetails, credits, keywords] = await Promise.all([
      fetchFromTMDB(`/movie/${id}`),
      fetchFromTMDB(`/movie/${id}/credits`),
      fetchFromTMDB(`/movie/${id}/keywords`)
    ]);

    // Combine all data
    const completeMovieData = {
      ...movieDetails,
      cast: credits.cast,
      crew: credits.crew,
      keywords: keywords.keywords
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
    
    // Fetch complete details for each movie in parallel
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const [movieDetails, credits, keywords] = await Promise.all([
            fetchFromTMDB(`/movie/${movie.id}`),
            fetchFromTMDB(`/movie/${movie.id}/credits`),
            fetchFromTMDB(`/movie/${movie.id}/keywords`)
          ]);

          return {
            ...movieDetails,
            cast: credits.cast?.slice(0, 10) || [],
            crew: credits.crew || [],
            keywords: keywords.keywords || []
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

// Get trending TV shows
app.get('/api/tv/trending', async (req, res) => {
  try {
    const cacheKey = 'trending_tv';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/trending/tv/day');
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching trending TV shows:', error);
    // Return mock data as fallback
    const mockData = getMockData('/trending/tv/day');
    res.json(mockData);
  }
});

// Get popular TV shows
app.get('/api/tv/popular', async (req, res) => {
  try {
    const cacheKey = 'popular_tv';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/tv/popular');
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching popular TV shows:', error);
    res.status(500).json({ error: 'Failed to fetch popular TV shows' });
  }
});

// Get top rated TV shows
app.get('/api/tv/top-rated', async (req, res) => {
  try {
    const cacheKey = 'top_rated_tv';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/tv/top_rated');
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching top rated TV shows:', error);
    res.status(500).json({ error: 'Failed to fetch top rated TV shows' });
  }
});

// Get TV shows by genre
app.get('/api/tv/genre/:genreId', async (req, res) => {
  try {
    const { genreId } = req.params;
    const cacheKey = `tv_genre_${genreId}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/discover/tv', { with_genres: genreId });
    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('Error fetching TV shows by genre:', error);
    res.status(500).json({ error: 'Failed to fetch TV shows by genre' });
  }
});

// Get TV show details
app.get('/api/tv/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `tv_${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB(`/tv/${id}`, {
      append_to_response: 'videos,credits,similar,recommendations'
    });
    setCache(cacheKey, data);
    res.json(data);
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
            const [movieDetails, credits, keywords] = await Promise.all([
              fetchFromTMDB(`/movie/${item.id}`),
              fetchFromTMDB(`/movie/${item.id}/credits`),
              fetchFromTMDB(`/movie/${item.id}/keywords`)
            ]);

            return {
              ...movieDetails,
              media_type: 'movie',
              cast: credits.cast?.slice(0, 10) || [],
              crew: credits.crew || [],
              keywords: keywords.keywords || []
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
app.get('/api/movies/top-rated', async (req, res) => {
  try {
    const cacheKey = 'top_rated_movies_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/movie/top_rated');
    
    // Fetch complete details for each movie in parallel
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const [movieDetails, credits, keywords] = await Promise.all([
            fetchFromTMDB(`/movie/${movie.id}`),
            fetchFromTMDB(`/movie/${movie.id}/credits`),
            fetchFromTMDB(`/movie/${movie.id}/keywords`)
          ]);

          return {
            ...movieDetails,
            cast: credits.cast?.slice(0, 10) || [],
            crew: credits.crew || [],
            keywords: keywords.keywords || []
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
    
    // Fetch complete details for each movie in parallel
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const [movieDetails, credits, keywords] = await Promise.all([
            fetchFromTMDB(`/movie/${movie.id}`),
            fetchFromTMDB(`/movie/${movie.id}/credits`),
            fetchFromTMDB(`/movie/${movie.id}/keywords`)
          ]);

          return {
            ...movieDetails,
            cast: credits.cast?.slice(0, 10) || [],
            crew: credits.crew || [],
            keywords: keywords.keywords || []
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
app.get('/api/movies/now-playing', async (req, res) => {
  try {
    const cacheKey = 'now_playing_movies_complete';
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB('/movie/now_playing');
    
    // Fetch complete details for each movie in parallel
    const moviesWithDetails = await Promise.all(
      data.results.slice(0, 20).map(async (movie) => {
        try {
          const [movieDetails, credits, keywords] = await Promise.all([
            fetchFromTMDB(`/movie/${movie.id}`),
            fetchFromTMDB(`/movie/${movie.id}/credits`),
            fetchFromTMDB(`/movie/${movie.id}/keywords`)
          ]);

          return {
            ...movieDetails,
            cast: credits.cast?.slice(0, 10) || [],
            crew: credits.crew || [],
            keywords: keywords.keywords || []
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

// Get movie trailers
app.get('/api/movies/:id/trailer', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `movie_trailer_${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB(`/movie/${id}/videos`);
    const trailer = data.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');
    
    if (trailer) {
      const result = { trailer_url: `https://www.youtube.com/watch?v=${trailer.key}` };
      setCache(cacheKey, result);
      res.json(result);
    } else {
      res.status(404).json({ error: 'No trailer found' });
    }
  } catch (error) {
    console.error('Error fetching movie trailer:', error);
    res.status(500).json({ error: 'Failed to fetch movie trailer' });
  }
});

// Get TV show trailers
app.get('/api/tv/:id/trailer', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `tv_trailer_${id}`;
    const cached = getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchFromTMDB(`/tv/${id}/videos`);
    const trailer = data.results.find(video => video.type === 'Trailer' && video.site === 'YouTube');
    
    if (trailer) {
      const result = { trailer_url: `https://www.youtube.com/watch?v=${trailer.key}` };
      setCache(cacheKey, result);
      res.json(result);
    } else {
      res.status(404).json({ error: 'No trailer found' });
    }
  } catch (error) {
    console.error('Error fetching TV show trailer:', error);
    res.status(500).json({ error: 'Failed to fetch TV show trailer' });
  }
});

// Streaming Routes

// Get movie stream URL
app.get('/api/stream/movie/:id', (req, res) => {
  const { id } = req.params;
  
  // Note: This is a placeholder. The actual stream won't work until the domain is whitelisted
  res.json({
    hls: `${STREAM_BASE_URL}/movies/${id}/index.m3u8`,
    fallback: `${VIDSRC_BASE_URL}/movie?tmdb=${id}`,
    note: 'Streaming will be available once the domain is whitelisted'
  });
});

// Get TV show stream URL
app.get('/api/stream/tv/:id/:season/:episode', (req, res) => {
  const { id, season, episode } = req.params;
  
  // Note: This is a placeholder. The actual stream won't work until the domain is whitelisted
  res.json({
    hls: `${STREAM_BASE_URL}/tv/${id}/${season}/${episode}/index.m3u8`,
    fallback: `${VIDSRC_BASE_URL}/tv?tmdb=${id}&season=${season}&episode=${episode}`,
    note: 'Streaming will be available once the domain is whitelisted'
  });
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
  console.log('🚀 Backend ready to serve requests!');
}); 