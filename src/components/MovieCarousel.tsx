import React from 'react';
import { Movie, TVShow } from '@/services/api';
import { ChevronLeft, ChevronRight, Play, Star, Calendar } from 'lucide-react';

export interface MovieCarouselProps {
  title: string;
  items: (Movie | TVShow)[];
  onItemClick: (item: Movie | TVShow) => void;
  isUpcoming?: boolean;
}

const MovieCarousel: React.FC<MovieCarouselProps> = ({ title, items, onItemClick, isUpcoming = false }) => {
  const scrollLeft = () => {
    const container = document.getElementById(`carousel-${title}`);
    if (container) {
      container.scrollLeft -= container.offsetWidth - 100;
    }
  };

  const scrollRight = () => {
    const container = document.getElementById(`carousel-${title}`);
    if (container) {
      container.scrollLeft += container.offsetWidth - 100;
    }
  };

  const formatReleaseDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getItemTitle = (item: Movie | TVShow): string => {
    return 'title' in item ? item.title : item.name;
  };

  const getItemReleaseDate = (item: Movie | TVShow): string => {
    return 'release_date' in item ? item.release_date : item.first_air_date;
  };

  return (
    <div className="w-full relative group">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
      </div>

      {/* Scroll Buttons */}
      <button
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>

      <button
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/70"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>

      {/* Movie Cards Container */}
      <div
        id={`carousel-${title}`}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth"
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {items && items.length > 0 ? items.map((item) => (
          <div
            key={item.id}
            className="flex-none w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px] snap-start cursor-pointer group/item"
            onClick={() => onItemClick(item)}
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden">
              <img
                src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                alt={getItemTitle(item)}
                className="w-full h-full object-cover transform group-hover/item:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {/* Play Button or Calendar Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover/item:opacity-100">
                {isUpcoming ? (
                  <div className="bg-black/60 rounded-full p-4 flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                ) : (
                  <div className="crystal-play-button">
                    {/* Triangle is created via CSS ::before pseudo-element */}
                  </div>
                )}
              </div>
              {/* Rating Badge or Release Date Badge */}
              {isUpcoming ? (
                <div className="absolute top-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 z-10">
                  <Calendar className="w-3 h-3" />
                  {formatReleaseDate(getItemReleaseDate(item))}
                </div>
              ) : (
                typeof item.vote_average === 'number' && (
                  <div className="absolute top-2 right-2 bg-black/80 text-yellow-400 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 z-10">
                    <Star className="w-3 h-3" />
                    {item.vote_average.toFixed(1)}
                  </div>
                )
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <div>
                  <h3 className="text-white font-semibold text-sm line-clamp-2">
                    {getItemTitle(item)}
                  </h3>
                  <p className="text-gray-300 text-xs mt-1">
                    {formatReleaseDate(getItemReleaseDate(item))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="flex items-center justify-center w-full py-8 text-gray-500">
            No items available
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `
      }} />
    </div>
  );
};

export default MovieCarousel; 