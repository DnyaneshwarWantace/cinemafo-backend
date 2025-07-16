import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://cinemafo.lol/api';

// Client-side cache for movie details
const movieCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const getCacheKey = (endpoint: string, id?: number, params?: any) => {
  const paramString = params ? JSON.stringify(params) : '';
  return `${endpoint}_${id || ''}_${paramString}`;
};

const getFromCache = (key: string) => {
  const cached = movieCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 Cache HIT for ${key}`);
    return cached.data;
  }
  if (cached) {
    movieCache.delete(key);
  }
  return null;
};

const setCache = (key: string, data: any) => {
  if (movieCache.size >= 200) {
    const oldestKey = movieCache.keys().next().value;
    movieCache.delete(oldestKey);
  }
  movieCache.set(key, { data, timestamp: Date.now() });
  console.log(`💾 Cache SET for ${key} (size: ${movieCache.size})`);
};

// Cache management utilities
export const cacheUtils = {
  clear: () => {
    movieCache.clear();
    console.log('🗑️ Cache cleared');
  },
  
  clearMovie: (movieId: number) => {
    const keysToDelete = Array.from(movieCache.keys()).filter(key => 
      key.includes(`_${movieId}_`)
    );
    keysToDelete.forEach(key => movieCache.delete(key));
    console.log(`🗑️ Cleared cache for movie ${movieId}`);
  },
  
  getStats: () => ({
    size: movieCache.size,
    keys: Array.from(movieCache.keys())
  })
};

export interface Movie {
  id: number;
  title: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  media_type?: string;
  original_language?: string;
  available_languages?: string[];
  runtime?: number;
  status?: string;
  budget?: number;
  revenue?: number;
  tagline?: string;
  production_companies?: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  production_countries?: {
    iso_3166_1: string;
    name: string;
  }[];
  spoken_languages?: {
    iso_639_1: string;
    name: string;
  }[];
  cast?: {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order: number;
  }[];
  crew?: {
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
  }[];
  keywords?: {
    id: number;
    name: string;
  }[];
  recommendations?: {
    id: number;
    title: string;
    poster_path: string;
    vote_average: number;
  }[];
}

export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  media_type?: string;
  number_of_seasons?: number;
  seasons?: Season[];
  original_language?: string;
  available_languages?: string[];
  runtime?: number;
  status?: string;
  budget?: number;
  revenue?: number;
  tagline?: string;
  production_companies?: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  production_countries?: {
    iso_3166_1: string;
    name: string;
  }[];
  spoken_languages?: {
    iso_639_1: string;
    name: string;
  }[];
  cast?: {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order: number;
  }[];
  crew?: {
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
  }[];
  keywords?: {
    id: number;
    name: string;
  }[];
  recommendations?: {
    id: number;
    title: string;
    poster_path: string;
    vote_average: number;
  }[];
}

export interface Season {
  season_number: number;
  name: string;
  episode_count: number;
  overview: string;
  poster_path: string;
}

export interface Episode {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string;
  air_date: string;
  vote_average: number;
}

const api = {
  // Movies - All with caching
  getTrendingMovies: (language?: string) => {
    const cacheKey = getCacheKey('trending_movies', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/trending`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getPopularMovies: (language?: string) => {
    const cacheKey = getCacheKey('popular_movies', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/popular`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getTopRatedMovies: (language?: string) => {
    const cacheKey = getCacheKey('top_rated_movies', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/top-rated`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getUpcomingMovies: (language?: string) => {
    const cacheKey = getCacheKey('upcoming_movies', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/upcoming`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getNowPlayingMovies: (language?: string) => {
    const cacheKey = getCacheKey('now_playing_movies', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/now-playing`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getMoviesByGenre: (genreId: number, language?: string) => {
    const cacheKey = getCacheKey('movies_by_genre', genreId, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/genre/${genreId}`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getMovieDetails: (movieId: number, language?: string) => {
    const cacheKey = getCacheKey('movie_details', movieId, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/${movieId}`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getMovieTrailer: (movieId: number, language?: string) => {
    const cacheKey = getCacheKey('movie_trailer', movieId, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/movies/${movieId}/trailer`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },
  
  // TV Shows - All with caching
  getTrendingShows: (language?: string) => {
    const cacheKey = getCacheKey('trending_shows', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/trending`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getPopularShows: (language?: string) => {
    const cacheKey = getCacheKey('popular_shows', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/popular`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getTopRatedShows: (language?: string) => {
    const cacheKey = getCacheKey('top_rated_shows', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/top-rated`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getShowsByGenre: (genreId: number, language?: string) => {
    const cacheKey = getCacheKey('shows_by_genre', genreId, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/genre/${genreId}`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getShowDetails: (showId: number, language?: string) => {
    const cacheKey = getCacheKey('show_details', showId, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/${showId}`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getShowTrailer: (showId: number, language?: string) => {
    const cacheKey = getCacheKey('show_trailer', showId, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/${showId}/trailer`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getShowSeason: (showId: number, seasonNumber: number, language?: string) => {
    const cacheKey = getCacheKey('show_season', showId, { season: seasonNumber, language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/${showId}/season/${seasonNumber}`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  // Search - with caching
  search: (query: string, language?: string) => {
    const cacheKey = getCacheKey('search', undefined, { query, language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/search`, { params: { query, language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },
  
  // Genres - with caching (longer cache since genres rarely change)
  getMovieGenres: (language?: string) => {
    const cacheKey = getCacheKey('movie_genres', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/genres/movie`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getTVGenres: (language?: string) => {
    const cacheKey = getCacheKey('tv_genres', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/genres/tv`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  // Languages - with caching
  getAvailableLanguages: (contentId: number, type: 'movie' | 'tv') => {
    const cacheKey = getCacheKey('available_languages', contentId, { type });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/${type}/${contentId}/languages`)
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  // New TV show category endpoints
  getWebSeries: (language?: string) => {
    const cacheKey = getCacheKey('web_series', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/web-series`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getCrimeDramas: (language?: string) => {
    const cacheKey = getCacheKey('crime_dramas', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/crime-dramas`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getSciFiFantasy: (language?: string) => {
    const cacheKey = getCacheKey('sci_fi_fantasy', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/sci-fi-fantasy`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },

  getComedySeries: (language?: string) => {
    const cacheKey = getCacheKey('comedy_series', undefined, { language });
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return Promise.resolve({ data: cached });
    }
    
    return axios.get(`${BASE_URL}/tv/comedy-series`, { params: { language } })
      .then(response => {
        setCache(cacheKey, response.data);
        return response;
      });
  },
};

export default api; 