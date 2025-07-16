import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Play, Star, Calendar, Clock, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import HeroSlider from "@/components/HeroSlider";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import MovieModal from "@/components/MovieModal";
import LoadingBar from "@/components/LoadingBar";
import AdBanner from "@/components/AdBanner";
import api from "@/services/api";

const genres = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' }
];

const tvGenres = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' }
];

const Index = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [contentType, setContentType] = useState('movie');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMovies = async (endpoint: string) => {
    // Use backend API instead of direct TMDB calls
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`);
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  };

  const fetchFilteredContent = async () => {
    if (searchQuery) {
      // Use search endpoint
      const response = await api.search(searchQuery);
      return response.data;
    } else if (selectedGenre && selectedGenre !== 'all') {
      // Use genre endpoint
      const genreId = parseInt(selectedGenre);
      if (contentType === 'movie') {
        const response = await api.getMoviesByGenre(genreId);
        return response.data;
      } else {
        const response = await api.getShowsByGenre(genreId);
        return response.data;
      }
    }
    throw new Error('Invalid filter combination');
  };

  const { data: trendingMovies } = useQuery({
    queryKey: ['trending', 'movie'],
    queryFn: () => api.getTrendingMovies(),
  });

  const { data: topRatedMovies } = useQuery({
    queryKey: ['topRated', 'movie'],
    queryFn: () => api.getTopRatedMovies(),
  });

  const { data: popularMovies } = useQuery({
    queryKey: ['popular', 'movie'],
    queryFn: () => api.getPopularMovies(),
  });

  const { data: trendingTv } = useQuery({
    queryKey: ['trending', 'tv'],
    queryFn: () => api.getTrendingShows(),
  });

  const { data: filteredContent } = useQuery({
    queryKey: ['filtered', contentType, selectedGenre, sortBy, searchQuery],
    queryFn: fetchFilteredContent,
    enabled: !!(selectedGenre !== 'all' || searchQuery),
  });

  const handleMovieClick = (movie: any) => {
    setSelectedMovie(movie);
  };

  const MovieCard = ({ movie, isLarge = false }: { movie: any, isLarge?: boolean }) =>
    <Card 
      className={`${isLarge ? 'w-[300px]' : 'w-[200px]'} bg-gray-900/50 border-gray-800 card-hover cursor-pointer flex-shrink-0`}
      onClick={() => handleMovieClick(movie)}
    >
      <CardContent className="p-0 relative">
        <div className="relative aspect-[2/3] w-full">
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title || movie.name}
            className="w-full h-full object-cover rounded-t-lg"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.svg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent rounded-t-lg" />
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className={`text-white font-bold ${isLarge ? 'text-lg' : 'text-sm'} mb-2 line-clamp-2`}>
              {movie.title || movie.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Star className="w-3 h-3 text-yellow-400" />
              <span>{movie.vote_average?.toFixed(1)}</span>
              <Calendar className="w-3 h-3 ml-2" />
              <span>{new Date(movie.release_date || movie.first_air_date).getFullYear()}</span>
            </div>
          </div>
          <Button 
            size="sm" 
            className="absolute top-4 right-4 bg-red-600 hover:bg-red-700"
            onClick={(e) => {
              e.stopPropagation();
              handleMovieClick(movie);
            }}
          >
            <Play className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>;

  const MovieSection = ({ title, movies, isLarge = false }: { title: string, movies: any[], isLarge?: boolean }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const itemsPerPage = 6;
    const totalPages = Math.ceil(movies?.length / itemsPerPage);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        const newPage = direction === 'left' 
          ? Math.max(0, currentPage - 1)
          : Math.min(totalPages - 1, currentPage + 1);
        
        setCurrentPage(newPage);
        const cardWidth = isLarge ? 300 : 200; // Width of each card
        const gap = 16; // Gap between cards (4 units in Tailwind = 16px)
        const scrollAmount = newPage * (cardWidth + gap) * itemsPerPage;
        scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
      }
    };

    return (
      <section className="mb-12 relative group pt-4">
        <h2 className="text-2xl font-bold text-white mb-6 pl-4">{title}</h2>
        <div className="relative">
          {/* Left Arrow */}
          {currentPage > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full w-10 h-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          
          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-hidden pb-4 relative px-4"
            style={{
              maskImage: 'linear-gradient(to right, black 95%, transparent 98%)',
              WebkitMaskImage: 'linear-gradient(to right, black 95%, transparent 98%)'
            }}
          >
            {movies?.map((movie) => (
              <MovieCard key={movie.id} movie={movie} isLarge={isLarge} />
            ))}
          </div>

          {/* Right Arrow */}
          {currentPage < totalPages - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white rounded-full w-10 h-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-black">
      <LoadingBar isLoading={isLoading} />
      <Navigation />
      
      {/* Hero Slider */}
      <HeroSlider items={trendingMovies?.data?.results?.slice(0, 5) || []} onItemClick={handleMovieClick} />

      <div className="container mx-auto px-4 py-8 pt-20">
        {/* Home Page Ad */}
        <div className="mb-8">
          <AdBanner 
            adKey="homePageAd" 
            imageUrl="https://picsum.photos/400/200?random=home-page"
            clickUrl="https://example.com"
            enabled={true}
          />
        </div>

        {/* Simple Netflix-style Discover Filters */}
        <div className="flex flex-wrap gap-4 mb-8 p-6 bg-gray-900/80 rounded-lg border border-gray-800">
          <div className="flex gap-4 items-center flex-wrap">
                  <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
              <SelectContent>
                <SelectItem value="movie">Movies</SelectItem>
                <SelectItem value="tv">TV Shows</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Genre" />
                    </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                      {(contentType === 'movie' ? genres : tvGenres)?.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id.toString()}>
                          {genre.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
              <SelectContent>
                <SelectItem value="popularity.desc">Popular</SelectItem>
                <SelectItem value="vote_average.desc">Top Rated</SelectItem>
                <SelectItem value="release_date.desc">Latest</SelectItem>
                <SelectItem value="revenue.desc">Box Office</SelectItem>
                    </SelectContent>
                  </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search movies & TV shows..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white pl-10 pr-10"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1 h-6 w-6"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
            </div>
          </div>
        </div>

        {/* Filtered Results */}
        {(selectedGenre !== 'all' || searchQuery) && filteredContent?.results && (
          <MovieSection 
            title={searchQuery ? `Search Results for "${searchQuery}"` : `${contentType === 'movie' ? 'Movies' : 'TV Shows'} - ${genres.find(g => g.id.toString() === selectedGenre)?.name || tvGenres.find(g => g.id.toString() === selectedGenre)?.name}`}
            movies={filteredContent.results}
            isLarge={true}
          />
        )}

        {/* Movie Sections */}
        {!searchQuery && selectedGenre === 'all' && (
          <>
            <MovieSection title="Trending Movies" movies={trendingMovies?.data?.results || []} isLarge={true} />
            <MovieSection title="Top Rated Movies" movies={topRatedMovies?.data?.results || []} />
            <MovieSection title="Popular Movies" movies={popularMovies?.data?.results || []} />
            <MovieSection title="Trending TV Shows" movies={trendingTv?.data?.results || []} />
          </>
        )}

        {/* Bottom Ad */}
        <div className="mt-12">
          <AdBanner 
            adKey="homePageBottomAd" 
            imageUrl="https://picsum.photos/400/200?random=home-bottom"
            clickUrl="https://example.com"
            enabled={true}
          />
        </div>
      </div>

      <Footer />
      
      {selectedMovie && (
        <MovieModal 
          movie={selectedMovie} 
          onClose={() => setSelectedMovie(null)} 
        />
      )}
    </div>
  );
};

export default Index;
