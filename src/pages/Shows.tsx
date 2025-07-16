import React, { useEffect, useState } from 'react';
import { Filter, Grid, List, Star, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MovieModal from '@/components/MovieModal';
import MovieCarousel from '@/components/MovieCarousel';
import TVShowPlayer from '@/components/TVShowPlayer';
import AdBanner from '@/components/AdBanner';
import api, { Movie, TVShow } from '@/services/api';
import { Loader2 } from 'lucide-react';

const Shows = () => {
  const [selectedShow, setSelectedShow] = useState<TVShow | null>(null);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [trendingShows, setTrendingShows] = useState<TVShow[]>([]);
  const [popularShows, setPopularShows] = useState<TVShow[]>([]);
  const [topRatedShows, setTopRatedShows] = useState<TVShow[]>([]);
  const [filteredShows, setFilteredShows] = useState<TVShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const genresResponse = await api.getTVGenres();
        setGenres(genresResponse.data?.genres || []);
      } catch (err) {
        setError('Failed to load genres');
        console.error(err);
      }
    };
    fetchGenres();
  }, []);

  const fetchShows = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trending, popular, topRated] = await Promise.all([
        api.getTrendingShows(),
        api.getPopularShows(),
        api.getTopRatedShows()
      ]);

      setTrendingShows(trending.data?.results || []);
      setPopularShows(popular.data?.results || []);
      setTopRatedShows(topRated.data?.results || []);
      setFilteredShows(popular.data?.results || []); // Default to popular shows
    } catch (error) {
      console.error('Error fetching shows:', error);
      setError('Failed to load TV shows. Please try again later.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchShows();
  }, []);

  useEffect(() => {
    if (selectedGenre !== 'all' || sortBy !== 'popularity.desc') {
      applyFilters();
    }
  }, [selectedGenre, sortBy]);

  const applyFilters = async () => {
    try {
      let response;
      if (selectedGenre !== 'all') {
        response = await api.getShowsByGenre(parseInt(selectedGenre));
        setFilteredShows(response.data?.results || []);
      } else {
        // Use existing data based on sort
        switch (sortBy) {
          case 'vote_average.desc':
            setFilteredShows(topRatedShows);
            break;
          case 'first_air_date.desc':
            const sortedByDate = [...popularShows].sort((a, b) => 
              new Date(b.first_air_date).getTime() - new Date(a.first_air_date).getTime()
            );
            setFilteredShows(sortedByDate);
            break;
          case 'name.asc':
            const sortedAsc = [...popularShows].sort((a, b) => a.name.localeCompare(b.name));
            setFilteredShows(sortedAsc);
            break;
          case 'name.desc':
            const sortedDesc = [...popularShows].sort((a, b) => b.name.localeCompare(a.name));
            setFilteredShows(sortedDesc);
            break;
          default:
            setFilteredShows(popularShows);
            break;
        }
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  };

  const handleGenreChange = (genreId: string) => {
    setSelectedGenre(genreId);
  };

  const handleSortChange = (sortValue: string) => {
    setSortBy(sortValue);
  };

  const handleShowClick = (show: TVShow) => {
    setSelectedShow(show);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="w-full px-4 sm:px-6 lg:px-8 space-y-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">TV Shows</h1>
          <p className="text-xl text-gray-400">Discover amazing TV shows and series from around the world</p>
        </div>

        {/* Top Ad */}
        <div className="mb-8">
          <AdBanner 
            adKey="showsPageAd" 
            imageUrl="https://picsum.photos/400/200?random=shows-top"
            clickUrl="https://example.com"
            enabled={true}
          />
        </div>

        {/* Enhanced Filters */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 mb-8 border border-gray-700/50">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
      {/* Genre Filter */}
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-gray-400" />
                <Select value={selectedGenre} onValueChange={handleGenreChange}>
                  <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="All Genres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {genres.map((genre) => (
                      <SelectItem key={genre.id} value={genre.id.toString()}>
              {genre.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Filter */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Sort by:</span>
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popularity.desc">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} />
                        Most Popular
                      </div>
                    </SelectItem>
                    <SelectItem value="vote_average.desc">
                      <div className="flex items-center gap-2">
                        <Star size={16} />
                        Highest Rated
                      </div>
                    </SelectItem>
                    <SelectItem value="first_air_date.desc">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        Newest First
                      </div>
                    </SelectItem>
                    <SelectItem value="name.asc">A-Z</SelectItem>
                    <SelectItem value="name.desc">Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-md p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Filtered Results */}
            {(selectedGenre !== 'all' || sortBy !== 'popularity.desc') && (
              <section className="mb-12">
          <MovieCarousel
                  title={`Filtered Shows ${selectedGenre !== 'all' ? `- ${genres.find(g => g.id.toString() === selectedGenre)?.name}` : ''}`}
                  items={filteredShows}
            onItemClick={handleShowClick}
          />
              </section>
            )}

            {/* Default Sections */}
            {selectedGenre === 'all' && sortBy === 'popularity.desc' && (
              <>
                <section className="mb-12">
              <MovieCarousel
                    title="Trending TV Shows"
                    items={trendingShows}
                onItemClick={handleShowClick}
              />
                </section>

                <section className="mb-12">
              <MovieCarousel
                    title="Popular TV Shows"
                    items={popularShows}
                onItemClick={handleShowClick}
              />
                </section>

                <section className="mb-12">
              <MovieCarousel
                    title="Top Rated TV Shows"
                    items={topRatedShows}
                onItemClick={handleShowClick}
              />
                </section>
              </>
            )}
          </>
        )}

        {/* Bottom Ad */}
        <div className="mt-12">
          <AdBanner 
            adKey="showsPageBottomAd" 
            imageUrl="https://picsum.photos/400/200?random=shows-bottom"
            clickUrl="https://example.com"
            enabled={true}
          />
        </div>
      </div>

      {/* TV Show Player */}
      {selectedShow && (
        <TVShowPlayer
          show={selectedShow}
          onClose={() => setSelectedShow(null)}
        />
      )}
    </div>
  );
};

export default Shows; 