import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, X, Star, Calendar, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import MovieModal from '@/components/MovieModal';
import TVShowPlayer from '@/components/TVShowPlayer';
import AdBanner from '@/components/AdBanner';
import api, { Movie, TVShow } from '@/services/api';
import { Loader2 } from 'lucide-react';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Movie | TVShow)[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Movie | TVShow | null>(null);
  const [mediaType, setMediaType] = useState('multi');
  const [filters, setFilters] = useState({
    genre: 'all',
    year: '',
    rating: 'any',
    sortBy: 'relevance'
  });

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query, mediaType, filters]);

  const performSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.search(query, mediaType);
      let searchResults = response.data?.results || [];
      
      // Apply filters
      if (filters.year) {
        searchResults = searchResults.filter(item => {
          const releaseDate = item.release_date || item.first_air_date;
          return releaseDate && new Date(releaseDate).getFullYear().toString() === filters.year;
        });
      }
      
      if (filters.rating && filters.rating !== 'any') {
        searchResults = searchResults.filter(item => 
          item.vote_average >= parseFloat(filters.rating)
        );
      }
      
      // Apply sorting
      switch (filters.sortBy) {
        case 'rating':
          searchResults.sort((a, b) => b.vote_average - a.vote_average);
          break;
        case 'date':
          searchResults.sort((a, b) => {
            const dateA = new Date(a.release_date || a.first_air_date || 0);
            const dateB = new Date(b.release_date || b.first_air_date || 0);
            return dateB.getTime() - dateA.getTime();
          });
          break;
        case 'title':
          searchResults.sort((a, b) => {
            const titleA = (a.title || a.name || '').toLowerCase();
            const titleB = (b.title || b.name || '').toLowerCase();
            return titleA.localeCompare(titleB);
          });
          break;
        default:
          // Relevance - keep original order
          break;
      }
      
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      } finally {
        setLoading(false);
      }
    };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setFilters({
      genre: 'all',
      year: '',
      rating: '',
      sortBy: 'relevance'
    });
  };

  const handleItemClick = (item: Movie | TVShow) => {
    setSelectedItem(item);
  };

  const clearFilters = () => {
    setFilters({
      genre: 'all',
      year: '',
      rating: '',
      sortBy: 'relevance'
    });
  };

  const hasActiveFilters = filters.genre !== 'all' || filters.year || filters.rating || filters.sortBy !== 'relevance';

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 space-y-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Search</h1>
          <p className="text-xl text-gray-400">Find your favorite movies and TV shows</p>
        </div>

        {/* Top Ad */}
        <div className="mb-8">
          <AdBanner 
            adKey="searchPageAd" 
            imageUrl="https://picsum.photos/400/200?random=search-top"
            clickUrl="https://example.com"
            enabled={true}
          />
      </div>

        {/* Search Bar */}
        <div className="flex flex-wrap gap-4 mb-8 p-6 bg-gray-900/80 rounded-lg border border-gray-800">
          <div className="flex gap-4 items-center flex-wrap w-full">
            <div className="relative flex-1 min-w-[300px]">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search movies, TV shows, or people..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white pl-10 pr-10 h-12 text-lg"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1 h-6 w-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Select value={mediaType} onValueChange={setMediaType}>
              <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-white h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multi">All</SelectItem>
                <SelectItem value="movie">Movies</SelectItem>
                <SelectItem value="tv">TV Shows</SelectItem>
                <SelectItem value="person">People</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 mb-8 border border-gray-700/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Year</label>
                <Input
                  type="number"
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                  placeholder="e.g. 2023"
                  min="1900"
                  max={new Date().getFullYear()}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Minimum Rating</label>
                <Select value={filters.rating} onValueChange={(value) => setFilters({ ...filters, rating: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Any rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any rating</SelectItem>
                    <SelectItem value="9">9+ Stars</SelectItem>
                    <SelectItem value="8">8+ Stars</SelectItem>
                    <SelectItem value="7">7+ Stars</SelectItem>
                    <SelectItem value="6">6+ Stars</SelectItem>
                    <SelectItem value="5">5+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Sort By</label>
                <Select value={filters.sortBy} onValueChange={(value) => setFilters({ ...filters, sortBy: value })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} />
                        Relevance
                      </div>
                    </SelectItem>
                    <SelectItem value="rating">
                      <div className="flex items-center gap-2">
                        <Star size={16} />
                        Rating
                      </div>
                    </SelectItem>
                    <SelectItem value="date">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        Release Date
                      </div>
                    </SelectItem>
                    <SelectItem value="title">Title A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {/* Results */}
        {!loading && query && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Search Results for "{query}"
              </h2>
              <span className="text-gray-400">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No results found for "{query}"</p>
                <p className="text-gray-500 mt-2">Try adjusting your search terms or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.map((item) => (
                  <div
                    key={item.id}
                    className="group cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
                      <img
                        src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                        alt={'title' in item ? item.title : item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/300x450/666666/ffffff?text=No+Image';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-2 right-2 bg-black/80 text-yellow-400 px-2 py-1 rounded text-xs font-semibold">
                        {item.vote_average?.toFixed(1) || 'N/A'}
                      </div>
                    </div>
                    <div className="mt-2">
                      <h3 className="text-sm font-medium text-white truncate">
                        {'title' in item ? item.title : item.name}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {('release_date' in item ? item.release_date : item.first_air_date)
                          ? new Date('release_date' in item ? item.release_date : item.first_air_date).getFullYear()
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Ad */}
        <div className="mt-12">
          <AdBanner 
            adKey="searchPageBottomAd" 
            imageUrl="https://picsum.photos/400/200?random=search-bottom"
            clickUrl="https://example.com"
            enabled={true}
            />
          </div>
      </div>

      {/* Movie Modal */}
      {selectedItem && 'title' in selectedItem && (
        <MovieModal
          movie={selectedItem as Movie}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* TV Show Player */}
      {selectedItem && 'name' in selectedItem && (
        <TVShowPlayer
          show={selectedItem as TVShow}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default Search; 