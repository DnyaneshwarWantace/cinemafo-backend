import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Home, Film, Tv, Search, Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import useAdminSettings from '@/hooks/useAdminSettings';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { settings: adminSettings } = useAdminSettings();

  const handleDiscordClick = () => {
    window.open('https://discord.gg/your-discord-server', '_blank');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', name: 'Home', icon: Home },
    { path: '/movies', name: 'Movies', icon: Film },
    { path: '/shows', name: 'Shows', icon: Tv },
    { path: '/search', name: 'Search', icon: Search },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  // Check if announcement bar is enabled
  const hasAnnouncementBar = adminSettings?.appearance?.announcementBar?.enabled;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (hasAnnouncementBar) {
        // If announcement bar is enabled, check if scrolled past it (48px height)
        setIsScrolled(window.scrollY > 48);
      } else {
        // If no announcement bar, check if scrolled at all
        setIsScrolled(window.scrollY > 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasAnnouncementBar]);

  return (
    <nav className={`bg-transparent backdrop-blur-0 border-b-0 sticky top-0 w-full z-50 transition-all duration-300 ${
      isScrolled ? 'bg-black/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
    }`}>
      <div className={`absolute inset-0 transition-all duration-300 ${
        isScrolled ? 'bg-gradient-to-b from-black/95 to-black/80' : 'bg-gradient-to-b from-black/80 via-black/20 to-transparent'
      }`}></div>
      <div className="w-full px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo and Nav */}
          <div className="flex items-center space-x-4 md:space-x-8">
            <div 
              className="cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigate('/')}
            >
              <img 
                src="/logo.svg" 
                alt="Cinema.fo" 
                className="h-8 w-auto md:h-12 drop-shadow-lg"
              />
            </div>
            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button 
                    key={item.path}
                    variant="ghost" 
                    className={`text-white/90 hover:text-blue-400 font-medium px-3 md:px-4 py-2 rounded-lg transition-all duration-200 text-sm md:text-base ${
                      isActive(item.path) ? 'text-blue-400' : 'hover:scale-105'
                    }`}
                    onClick={() => handleNavClick(item.path)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Right side - Discord and Mobile Menu */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Discord Icon - Desktop */}
            <Button 
              variant="ghost" 
              onClick={handleDiscordClick}
              className="hidden md:flex text-white/90 hover:text-blue-400 p-2 md:p-3 rounded-full hover:scale-110 transition-all duration-200"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-white/90 hover:text-blue-400 p-2 rounded-lg hover:scale-110 transition-all duration-200"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-md border-t border-gray-800">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={`w-full justify-start text-white/90 hover:text-blue-400 font-medium px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.path) ? 'text-blue-400 bg-blue-400/10' : 'hover:bg-white/10'
                    }`}
                    onClick={() => handleNavClick(item.path)}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Button>
                );
              })}
              {/* Discord in mobile menu */}
              <Button
                variant="ghost"
                onClick={handleDiscordClick}
                className="w-full justify-start text-white/90 hover:text-blue-400 font-medium px-4 py-3 rounded-lg transition-all duration-200 hover:bg-white/10"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Discord
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
