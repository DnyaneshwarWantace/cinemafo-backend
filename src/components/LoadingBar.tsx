
import React from 'react';

interface LoadingBarProps {
  isLoading: boolean;
}

const LoadingBar: React.FC<LoadingBarProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="loading-bar" />
  );
};

export default LoadingBar;
