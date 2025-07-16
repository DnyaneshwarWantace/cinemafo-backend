import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Play, Star, Calendar, Clock, Loader2, Film, Users, Globe, Info, DollarSign, 
  Award, Building2, MapPin, Languages, Tags, ArrowLeft, ChevronLeft, ChevronRight
} from "lucide-react";
import VideoPlayer from "./VideoPlayer";
import TVShowPlayer from "./TVShowPlayer";
import AdBanner from "./AdBanner";
import api, { Movie, TVShow, cacheUtils } from "@/services/api";

interface MovieModalProps {
  movie: Movie;
  onClose: () => void;
}

const MovieModal: React.FC<MovieModalProps> = ({ movie: initialMovie, onClose }) => {
  const [movie, setMovie] = useState<Movie>(initialMovie);
  const [loading, setLoading] = useState(false);
  const [showFullMovie, setShowFullMovie] = useState(false);
  const [showTVShowPlayer, setShowTVShowPlayer] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [relatedMovies, setRelatedMovies] = useState<Movie[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // No need to check for detailed data anymore - backend provides complete data
  console.log(`✅ Movie ${initialMovie.id} loaded with complete data from backend`);
  
  // Animation effect for opening
  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Fetch related movies
  useEffect(() => {
    const fetchRelatedMovies = async () => {
      try {
        setLoadingRelated(true);
        // Use the recommendations from movie details if available, otherwise fetch similar movies
        if (movie.recommendations && movie.recommendations.length > 0) {
          // Convert recommendations to Movie format
          const recommendationsAsMovies = movie.recommendations.map(rec => ({
            ...rec,
            overview: '',
            backdrop_path: '',
            release_date: '',
            vote_count: 0,
            genres: [],
            name: rec.title
          })) as Movie[];
          setRelatedMovies(recommendationsAsMovies.slice(0, 6));
        } else {
          // Fallback to popular movies in the same genre
          const genreId = movie.genres?.[0]?.id;
          if (genreId) {
            const response = await api.getMoviesByGenre(genreId);
            const similarMovies = response.data.results
              .filter((m: Movie) => m.id !== movie.id)
              .slice(0, 6);
            setRelatedMovies(similarMovies);
          } else {
            // Final fallback to popular movies
            const response = await api.getPopularMovies();
            const popularMovies = response.data.results
              .filter((m: Movie) => m.id !== movie.id)
              .slice(0, 6);
            setRelatedMovies(popularMovies);
          }
        }
    } catch (error) {
        console.error('Error fetching related movies:', error);
        setRelatedMovies([]);
    } finally {
        setLoadingRelated(false);
    }
  };

    fetchRelatedMovies();
  }, [movie.id, movie.recommendations, movie.genres]);



  const handleWatchNow = () => {
    const releaseDate = movie.release_date || movie.first_air_date;
    
    if (!releaseDate) {
      console.warn('No release date available for this content');
      return;
    }

    const releaseDateObj = new Date(releaseDate);
    const now = new Date();
    
    if (releaseDateObj > now) {
      console.log('Content is not yet released:', releaseDate);
      return;
    }

    const isTVShow = movie.media_type === 'tv' || (movie.name && !movie.title);
    
    if (isTVShow) {
      onClose();
      setShowTVShowPlayer(true);
    } else {
      setShowFullMovie(true);
    }
  };

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => onClose(), 300);
  };

  const formatReleaseDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Memoized computed values
  const director = useMemo(() => {
    if (!movie.crew) return null;
    return movie.crew.find(member => member.job === 'Director');
  }, [movie.crew]);

  const mainCast = useMemo(() => {
    if (!movie.cast) return [];
    return movie.cast.slice(0, 6);
  }, [movie.cast]);

  const isUpcoming = useMemo(() => {
    const releaseDate = new Date(movie.release_date || movie.first_air_date);
    return releaseDate > new Date();
  }, [movie.release_date, movie.first_air_date]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background rounded-lg p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      >
        {/* Background with backdrop image */}
        <div className="absolute inset-0">
              <img
            src={`https://image.tmdb.org/t/p/original${movie.backdrop_path || movie.poster_path}`}
              alt={movie.title || movie.name}
              className="w-full h-full object-cover"
              />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        </div>
      </div>

      {/* Modal Content */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-50 h-screen bg-transparent transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Back Button */}
        <div className="absolute top-0 left-0 right-0 z-20 h-16 bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 bg-black/80 hover:bg-black text-white p-3 rounded-full transition-all duration-200 backdrop-blur-sm border border-white/20 shadow-lg"
            aria-label="Close modal"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
            </div>

            {/* Content */}
        <ScrollArea className="h-full">
          {/* Content */}
          <div className="p-4 md:p-6 pt-24 relative z-10">
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
              {/* Poster Image */}
              <div className="flex-shrink-0">
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title || movie.name}
                  className="w-64 h-96 object-cover rounded-lg shadow-2xl"
                  />
                </div>

                {/* Main Info */}
                <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white">
                    {movie.title || movie.name}
                  </h2>

                  {movie.tagline && (
                  <p className="text-gray-300 italic mb-4 text-sm md:text-base">"{movie.tagline}"</p>
                  )}

                  {/* Primary Metadata */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {movie.vote_average > 0 && (
                    <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-600/80 text-white">
                        <Star className="w-3 h-3 text-yellow-400" />
                        {movie.vote_average.toFixed(1)}
                        {movie.vote_count > 0 && (
                          <span className="text-xs">({movie.vote_count.toLocaleString()} votes)</span>
                        )}
                      </Badge>
                    )}
                  <Badge variant="outline" className="flex items-center gap-1 bg-gray-800/80 text-white border-gray-600">
                      <Calendar className="w-3 h-3" />
                      {formatReleaseDate(movie.release_date || movie.first_air_date)}
                    </Badge>
                {movie.runtime && (
                    <Badge variant="outline" className="flex items-center gap-1 bg-gray-800/80 text-white border-gray-600">
                        <Clock className="w-3 h-3" />
                        {formatRuntime(movie.runtime)}
                      </Badge>
                    )}
                    {movie.genres?.map((genre: any) => (
                    <Badge key={genre.id} variant="secondary" className="bg-gray-800/80 text-white">
                        {genre.name}
                      </Badge>
                    ))}
                  </div>

                  {/* Overview */}
                <p className="text-gray-200 mb-6 text-sm md:text-base leading-relaxed">{movie.overview}</p>

                  {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    {isUpcoming ? (
                    <Button disabled className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-md text-base font-semibold cursor-not-allowed opacity-75">
                        <Calendar className="w-4 h-4" />
                        Coming {formatReleaseDate(movie.release_date || movie.first_air_date)}
                      </Button>
                    ) : (
                    <Button onClick={handleWatchNow} className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-md text-base font-semibold hover:bg-gray-200 transition-all duration-200 hover:scale-105 transform">
                        <Film className="w-4 h-4" />
                        Watch Now
                      </Button>
                )}
              </div>
              
                  {/* Detailed Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {director && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <Film className="w-4 h-4" />
                      <span>Director: {director.name}</span>
                      </div>
                    )}
                    {movie.status && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <Info className="w-4 h-4" />
                      <span>
                          {movie.status === 'Released' 
                            ? `Released on ${formatReleaseDate(movie.release_date)}` 
                            : movie.status}
                        </span>
                      </div>
                    )}
                    {movie.original_language && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <Globe className="w-4 h-4" />
                      <span>Original Language: {movie.original_language.toUpperCase()}</span>
                      </div>
                    )}
                    {movie.budget > 0 && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <DollarSign className="w-4 h-4" />
                      <span>Budget: {formatMoney(movie.budget)}</span>
                      </div>
                    )}
                    {movie.revenue > 0 && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <Award className="w-4 h-4" />
                      <span>Revenue: {formatMoney(movie.revenue)}</span>
                      </div>
                    )}
                    {movie.production_companies?.[0] && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <Building2 className="w-4 h-4" />
                      <span>Studio: {movie.production_companies[0].name}</span>
                      </div>
                    )}
                    {movie.production_countries?.length > 0 && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <MapPin className="w-4 h-4" />
                      <span>
                          Countries: {movie.production_countries?.map(c => c.name).join(', ') || 'N/A'}
                        </span>
                      </div>
                    )}
                    {movie.spoken_languages?.length > 0 && (
                    <div className="flex items-center gap-2 text-gray-300">
                        <Languages className="w-4 h-4" />
                      <span>
                          Languages: {movie.spoken_languages?.map(l => l.name).join(', ') || 'N/A'}
                        </span>
            </div>
                    )}
          </div>

                  {/* Cast Section */}
                  {mainCast.length > 0 && (
                    <>
                    <Separator className="my-6 bg-gray-700" />
                      <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                          <Users className="w-5 h-5" />
                          Cast
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {mainCast.map(actor => (
                            <div key={actor.id} className="flex items-center gap-3">
                              {actor.profile_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${actor.profile_path}`}
                                  alt={actor.name}
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                                <Users className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div>
                              <p className="font-medium text-sm text-white">{actor.name}</p>
                              <p className="text-xs text-gray-400">{actor.character}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Keywords */}
                  {movie.keywords?.length > 0 && (
                    <>
                    <Separator className="my-6 bg-gray-700" />
                      <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                          <Tags className="w-5 h-5" />
                          Keywords
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {movie.keywords.map(keyword => (
                          <Badge key={keyword.id} variant="outline" className="text-xs bg-gray-800/80 text-white border-gray-600">
                              {keyword.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

              </div>
            </div>

            {/* Ad Banner */}
            <Separator className="my-6 bg-gray-700" />
            <div className="mb-6">
              <AdBanner 
                adKey="movieModalAd" 
                imageUrl="https://picsum.photos/400/200?random=movie-modal"
                clickUrl="https://example.com"
                enabled={true}
              />
            </div>
          
            {/* Related Movies - Full Width */}
            <Separator className="my-6 bg-gray-700" />
            <div className="w-full">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                <Film className="w-5 h-5" />
                Related Movies
              </h3>
              {loadingRelated ? (
                <div className="flex gap-4 overflow-x-auto">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex-none w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px] animate-pulse">
                      <div className="aspect-[2/3] bg-gray-700 rounded-lg mb-2" />
                      <div className="h-4 bg-gray-700 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : relatedMovies.length > 0 ? (
                <div className="w-full relative group">
                  {/* Scroll Buttons */}
              <button
                    onClick={() => {
                      const container = document.getElementById('related-movies-carousel');
                      if (container) {
                        container.scrollLeft -= container.offsetWidth - 100;
                      }
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70"
                    aria-label="Scroll left"
              >
                    <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              
                  <button
                    onClick={() => {
                      const container = document.getElementById('related-movies-carousel');
                      if (container) {
                        container.scrollLeft += container.offsetWidth - 100;
                      }
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                  
                  {/* Movie Cards Container */}
                  <div
                    id="related-movies-carousel"
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth"
                    style={{ 
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  >
                    {relatedMovies.map((relatedMovie) => (
                      <div
                        key={relatedMovie.id}
                        className="flex-none w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px] snap-start cursor-pointer group/item"
                        onClick={() => {
                          setMovie(relatedMovie);
                          setRelatedMovies([]);
                          setLoadingRelated(false);
                        }}
                      >
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden">
                          <img
                            src={`https://image.tmdb.org/t/p/w500${relatedMovie.poster_path}`}
                            alt={relatedMovie.title || relatedMovie.name}
                            className="w-full h-full object-cover transform group-hover/item:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover/item:opacity-100">
                            <div className="bg-black/60 rounded-full p-4 flex items-center justify-center">
                              <Play className="w-8 h-8 text-white" />
                            </div>
                          </div>
                          {/* Rating Badge */}
                          {relatedMovie.vote_average > 0 && (
                            <div className="absolute top-2 right-2 bg-black/80 text-yellow-400 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 z-10">
                              <Star className="w-3 h-3" />
                              {relatedMovie.vote_average.toFixed(1)}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <div>
                              <h3 className="text-white font-semibold text-sm line-clamp-2">
                                {relatedMovie.title || relatedMovie.name}
                              </h3>
                              <p className="text-gray-300 text-xs mt-1">
                                {formatReleaseDate(relatedMovie.release_date || relatedMovie.first_air_date)}
                              </p>
                            </div>
                          </div>
                        </div>
                </div>
                      ))}
                    </div>

                  <style dangerouslySetInnerHTML={{
                    __html: `
                      .scrollbar-hide::-webkit-scrollbar {
                        display: none;
                      }
                    `
                  }} />
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No related movies available.</p>
              )}
            </div>
          </div>
        </ScrollArea>
          </div>
          


      {/* TV Show Player */}
      {showTVShowPlayer && movie.media_type === 'tv' && (
        <TVShowPlayer
          show={{
            ...movie,
            name: movie.name || movie.title,
            first_air_date: movie.first_air_date || movie.release_date
          } as TVShow}
          onClose={() => setShowTVShowPlayer(false)}
        />
      )}

      {/* Full Movie Player */}
      {showFullMovie && (
        <VideoPlayer
          tmdbId={movie.id}
          type="movie"
          title={movie.title || movie.name}
          onClose={() => setShowFullMovie(false)}
        />
      )}
    </>
  );
};

export default MovieModal;