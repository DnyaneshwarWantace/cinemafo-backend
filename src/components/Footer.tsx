
import React from 'react';
import useAdminSettings from '@/hooks/useAdminSettings';

const Footer = () => {
  const { settings: adminSettings } = useAdminSettings();
  
  // Get content from settings
  const disclaimer = adminSettings?.content?.disclaimer;
  const aboutUs = adminSettings?.content?.aboutUs;
  const contactEmail = adminSettings?.content?.contactEmail;

  const handleContactClick = () => {
    if (contactEmail) {
      window.open(`mailto:${contactEmail}`, '_blank');
    }
  };

  return (
    <footer className="bg-gradient-to-t from-gray-900 via-gray-800 to-black border-t border-gray-700 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col items-center space-y-6 md:space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            <img 
              src="/logo.svg" 
              alt="CINEMA.FO" 
              className="h-8 w-auto md:h-12 lg:h-14 drop-shadow-lg"
            />
          </div>
          
          {/* About Us */}
          {aboutUs && (
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                {aboutUs}
              </p>
            </div>
          )}
          
          {/* Disclaimer */}
          {disclaimer && (
            <div className="max-w-3xl mx-auto bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 md:p-6 border border-gray-600/50">
              <h4 className="text-white font-semibold mb-2 text-sm md:text-base">Disclaimer:</h4>
              <p className="text-gray-400 text-xs md:text-sm leading-relaxed">
                {disclaimer}
              </p>
            </div>
          )}
          
          {/* Contact Section */}
          {contactEmail && (
            <div className="flex justify-center">
              <button 
                onClick={handleContactClick}
                className="text-gray-300 hover:text-white transition-all duration-300 text-sm md:text-base flex items-center gap-2 cursor-pointer bg-gray-800/70 hover:bg-gray-700/70 px-4 py-2 md:px-6 md:py-3 rounded-lg border border-gray-600/50 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                  <path d="M12 13.5l8-5V7l-8 5-8-5v1.5l8 5z"/>
                  <path d="M3 6h18v12H3V6zm0-1v14h18V5H3z"/>
                </svg>
                <span>Contact Us</span>
              </button>
            </div>
          )}
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-6 md:mt-8 pt-6 md:pt-8 text-center">
          <p className="text-gray-400 text-xs md:text-sm">
            © {new Date().getFullYear()} CINEMA.FO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
