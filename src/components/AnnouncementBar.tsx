import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AnnouncementBarProps {
  text: string;
  enabled: boolean;
  backgroundColor?: string;
  textColor?: string;
}

const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ text, enabled, backgroundColor = '#3b82f6', textColor = '#ffffff' }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (enabled && text.trim()) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [enabled, text]);

  if (!isVisible) {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <div 
      className="relative py-3 px-4 shadow-lg"
      style={{ 
        backgroundColor: backgroundColor,
        color: textColor
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center text-center">
        <div className="flex-1">
          <p className="text-sm font-medium">{text}</p>
        </div>
        <button
          onClick={handleClose}
          className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors duration-200"
          aria-label="Close announcement"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Gradient border effect */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
    </div>
  );
};

export default AnnouncementBar; 