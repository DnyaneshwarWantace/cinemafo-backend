import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { X, Play, Pause, Volume2, VolumeX, Settings, Maximize, Minimize, Languages, SkipForward, SkipBack, ArrowLeft, Zap, RefreshCw } from 'lucide-react';

interface VideoPlayerProps {
  tmdbId: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title: string;
  onClose: () => void;
}

interface AudioTrack {
  id: number;
  name: string;
  language: string;
  default: boolean;
}

interface StreamingSource {
  type: 'hls' | 'iframe';
  url: string;
  name: string;
  language?: string;
}

interface QualityLevel {
  height: number;
  width: number;
  bitrate: number;
  index: number;
  url: string | string[];
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  tmdbId, 
  type, 
  season, 
  episode, 
  title, 
  onClose 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const currentSourceUrlRef = useRef<string>('');
  // skipIntroTimeoutRef removed for now
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(-1);
  const [streamingSources, setStreamingSources] = useState<StreamingSource[]>([]);
  const [currentSource, setCurrentSource] = useState<StreamingSource | null>(null);
  const [isHLSSupported, setIsHLSSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForwardAnimation, setShowForwardAnimation] = useState(false);
  const [showBackwardAnimation, setShowBackwardAnimation] = useState(false);
  const [showCenterPlayButton, setShowCenterPlayButton] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'quality' | 'speed' | 'audio'>('quality');
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 means auto
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Skip intro functionality removed

  // Fetch stream URLs from backend with encrypted niggaflix URLs
  const fetchStreamUrls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'https://cinemafo.lol/api';
      
      // Try multiple endpoints in order of preference
      const endpoints = type === 'movie' 
        ? [
            `/official/movie/${tmdbId}`,
            `/niggaflix/movie/${tmdbId}`,
            `/stream/movie/${tmdbId}`
          ]
        : [
            `/official/tv/${tmdbId}/${season}/${episode}`,
            `/niggaflix/tv/${tmdbId}/${season}/${episode}`,
            `/stream/tv/${tmdbId}/${season}/${episode}`
          ];

      let streamUrl = null;
      let endpointUsed = '';

      // Try each endpoint until one works
      for (const endpoint of endpoints) {
        try {
          console.log(`🎬 Trying endpoint: ${baseUrl}${endpoint}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(8000) // 8 second timeout
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.stream && data.stream.url) {
              streamUrl = data.stream.url;
              endpointUsed = endpoint;
              console.log(`✅ Stream URL found from ${endpoint}: ${streamUrl}`);
              break;
            }
          }
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} failed:`, error);
          continue;
        }
      }
      
      if (streamUrl) {
        // Create sources array with encrypted niggaflix URL as primary
        const sources: StreamingSource[] = [
          {
            type: 'hls',
            url: streamUrl,
            name: `Niggaflix Stream (${endpointUsed})`,
            language: 'en'
          }
        ];

        // Add fallback iframe sources
        if (type === 'movie') {
          sources.push({
            type: 'iframe',
            url: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
            name: 'VidSrc Player (Fallback)',
            language: 'multi'
          });
        } else if (type === 'tv' && season && episode) {
          sources.push({
            type: 'iframe',
            url: `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
            name: 'VidSrc Player (Fallback)',
            language: 'multi'
          });
        }

        setStreamingSources(sources);
        setCurrentSource(sources[0]);
        return;
      } else {
        throw new Error('No stream URL found from any endpoint');
      }
    } catch (error) {
      console.error('❌ All backend endpoints failed:', error);
      
      // Fallback to iframe sources only
      const fallbackSources: StreamingSource[] = [];
      
      if (type === 'movie') {
        fallbackSources.push({
          type: 'iframe',
          url: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
          name: 'VidSrc Player (Fallback)',
          language: 'multi'
        });
      } else if (type === 'tv' && season && episode) {
        fallbackSources.push({
          type: 'iframe',
          url: `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
          name: 'VidSrc Player (Fallback)',
          language: 'multi'
        });
      }

      if (fallbackSources.length > 0) {
        console.log('🔄 Using fallback sources:', fallbackSources);
        setStreamingSources(fallbackSources);
        setCurrentSource(fallbackSources[0]);
      } else {
        setError('No streaming sources available');
      }
    } finally {
      setLoading(false);
    }
  }, [tmdbId, type, season, episode]);

  // Initialize sources on mount - only run once
  useEffect(() => {
    // Only fetch if we haven't already initialized
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchStreamUrls();
    }
    
    // Cleanup function to reset initialization when component unmounts
    return () => {
      initializedRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Skip intro functionality removed

  // Video controls
  const togglePlayPause = useCallback(() => {
    console.log('togglePlayPause called, current isPlaying:', isPlaying);
    console.log('videoRef.current:', videoRef.current);
    
    if (!videoRef.current) {
      console.log('No video element found');
      return;
    }
    
    if (isPlaying) {
      console.log('Pausing video');
      videoRef.current.pause();
    } else {
      console.log('Playing video');
      videoRef.current.play().catch((error) => {
        console.error('Error playing video:', error);
      });
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Skip forward 30 seconds
  const skipForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime += 30;
      setShowForwardAnimation(true);
      setTimeout(() => setShowForwardAnimation(false), 1000);
    }
  }, []);

  // Skip backward 30 seconds
  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 30;
      setShowBackwardAnimation(true);
      setTimeout(() => setShowBackwardAnimation(false), 1000);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (playerContainerRef.current) {
        playerContainerRef.current.requestFullscreen().catch(console.error);
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }
    }
  }, [isFullscreen]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't handle keys when typing in inputs
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'Enter':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyS':
          e.preventDefault();
          // Skip intro functionality removed
          break;
        case 'Escape':
          e.preventDefault();
          if (isFullscreen) {
            exitFullscreen();
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, skipBackward, skipForward, toggleFullscreen, toggleMute, onClose]);

  // Fullscreen detection
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Show center play button when paused
  useEffect(() => {
    if (!isPlaying && currentSource?.type === 'hls') {
      setShowCenterPlayButton(true);
    } else {
      setShowCenterPlayButton(false);
    }
  }, [isPlaying, currentSource]);

  // Handle double click on screen areas
  const handleScreenDoubleClick = (e: React.MouseEvent) => {
    if (currentSource?.type !== 'hls') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const screenWidth = rect.width;
    
    // Left side = backward, right side = forward
    if (clickX < screenWidth / 2) {
      skipBackward();
    } else {
      skipForward();
    }
  };

  // Initialize HLS player with quality levels
  useEffect(() => {
    if (!currentSource || currentSource.type !== 'hls' || !videoRef.current) return;
    
    // Check if the source URL has actually changed
    if (currentSourceUrlRef.current === currentSource.url) {
      console.log('Source URL unchanged, skipping HLS initialization');
      return;
    }
    
    currentSourceUrlRef.current = currentSource.url;
    
    // Prevent multiple HLS instances
    if (hlsRef.current) {
      console.log('HLS instance already exists, destroying previous instance');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    setIsHLSSupported(Hls.isSupported());
        
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
        backBufferLength: 90,
            maxBufferLength: 30,
        maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 1,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 6,
        maxFragLookUpTolerance: 0.25,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 40000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        startFragPrefetch: true,
        testBandwidth: true,
        progressive: true,
        lowLatencyMode: false,
        // Enable automatic quality switching by default
        startLevel: -1,
        capLevelToPlayerSize: true
          });

          hlsRef.current = hls;
      
      // Load source only once
      console.log('Loading HLS source:', currentSource.url);
      hls.loadSource(currentSource.url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('HLS manifest parsed successfully');
        setLoading(false);
        setError(null);
        video.play().catch((playError) => {
          console.warn('Autoplay failed:', playError);
        });

        // Get available quality levels
        const levels = hls.levels.map((level, index) => ({
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          index: index,
          url: Array.isArray(level.url) ? level.url[0] : level.url
        }));

        // For now, if no quality levels are available, add a fake 1080p option
        if (levels.length === 0) {
          levels.push({
            height: 1080,
            width: 1920,
            bitrate: 5000000,
            index: 0,
            url: currentSource.url
          });
        }
        
        setQualityLevels(levels);
        setCurrentQuality(-1); // Start with auto quality

        // Get available audio tracks
        const tracks = hls.audioTracks.map((track, index) => ({
          id: index,
          name: track.name || `Track ${index + 1}`,
                language: track.lang || 'unknown',
                default: track.default
              }));
        
              setAudioTracks(tracks);
        
        // Set default audio track
              const defaultTrack = tracks.find(track => track.default);
              if (defaultTrack) {
          setSelectedAudioTrack(defaultTrack.id);
              } else if (tracks.length > 0) {
          setSelectedAudioTrack(tracks[0].id);
        }
      });
      
      // Handle quality level loading
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentQuality(data.level);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error event:', event, data);
        
        // Handle non-fatal errors (like segment loading failures)
        if (!data.fatal) {
          console.log('Non-fatal HLS error, continuing playback');
          return;
        }
        
        // Handle fatal errors
        console.log('Fatal HLS error, attempting fallback');
        
        // Try to switch to iframe fallback
          const iframeSource = streamingSources.find(s => s.type === 'iframe');
          if (iframeSource) {
            console.log('Switching to iframe fallback:', iframeSource.url);
            setCurrentSource(iframeSource);
            setError(null);
            setLoading(true);
          
          // Cleanup HLS instance
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          } else {
            setError('Video source unavailable. Please try again later.');
            setLoading(false);
        }
      });

      // Video event listeners
      video.addEventListener('loadedmetadata', () => {
        setDuration(video.duration);
      });
      
      video.addEventListener('timeupdate', () => {
        setCurrentTime(video.currentTime);
      });
      
      video.addEventListener('play', () => setIsPlaying(true));
      video.addEventListener('pause', () => setIsPlaying(false));
      
      video.addEventListener('error', (videoError) => {
        console.error('Video element error:', videoError);
        const iframeSource = streamingSources.find(s => s.type === 'iframe');
        if (iframeSource) {
          console.log('Video error, switching to iframe fallback');
          setCurrentSource(iframeSource);
          setError(null);
          setLoading(true);
          
          // Cleanup HLS instance
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        } else {
          setError('Video playback failed. Please try again later.');
          setLoading(false);
        }
      });
      
      return () => {
        // Clean up event listeners
        if (video) {
          video.removeEventListener('loadedmetadata', () => setDuration(video.duration));
          video.removeEventListener('timeupdate', () => setCurrentTime(video.currentTime));
          video.removeEventListener('play', () => setIsPlaying(true));
          video.removeEventListener('pause', () => setIsPlaying(false));
          video.removeEventListener('error', (videoError) => {
            console.error('Video element error:', videoError);
            const iframeSource = streamingSources.find(s => s.type === 'iframe');
            if (iframeSource) {
              setCurrentSource(iframeSource);
              setError(null);
              setLoading(true);
            } else {
              setError('Video playback failed. Please try again later.');
              setLoading(false);
            }
          });
        }
        
        if (hls) {
          hls.destroy();
          hlsRef.current = null;
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      video.src = currentSource.url;
      video.play().catch((playError) => {
        console.warn('Safari HLS autoplay failed:', playError);
        // Only switch to iframe if playback fails
        const iframeSource = streamingSources.find(s => s.type === 'iframe');
        if (iframeSource) {
          setCurrentSource(iframeSource);
          setError(null);
          setLoading(true);
        }
      });
      setLoading(false);
      setError(null);
        }
    
    // Cleanup function
      return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
    }
      currentSourceUrlRef.current = '';
    };
  }, [currentSource?.url]); // Only re-run when the source URL changes

  // Audio track selection
  const handleAudioTrackChange = (trackId: string) => {
    const id = parseInt(trackId);
    setSelectedAudioTrack(id);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = id;
      console.log(`Switched to audio track: ${id}`);
    }
  };

  // Source switching
  const handleSourceChange = (sourceIndex: string) => {
    const index = parseInt(sourceIndex);
    const source = streamingSources[index];
    if (source) {
      setCurrentSource(source);
      setError(null);
      setLoading(true);
      console.log(`Switched to source: ${source.name}`);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Auto-hide controls
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isPlaying, showControls]);

  const enterFullscreen = () => {
    const container = document.querySelector('.video-player-container');
    if (container) {
      container.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettings(false);
  };

  // Handle quality change
  const handleQualityChange = (levelIndex: number) => {
    if (!hlsRef.current) return;
    
    const hls = hlsRef.current;
    
    if (levelIndex === -1) {
      // Auto quality
      hls.currentLevel = -1;
      hls.nextLevel = -1;
    } else {
      // Manual quality selection
      hls.currentLevel = levelIndex;
      hls.nextLevel = levelIndex;
    }
    
    setCurrentQuality(levelIndex);
    setShowSettingsMenu(false);
  };

  // Format quality label
  const getQualityLabel = (height: number) => {
    if (height <= 360) return '360p';
    if (height <= 480) return '480p';
    if (height <= 720) return '720p';
    if (height <= 1080) return '1080p';
    if (height <= 1440) return '1440p';
    return '4K';
  };

  // Settings menu auto-close timeout
  useEffect(() => {
    if (showSettingsMenu) {
      const timer = setTimeout(() => {
        setShowSettingsMenu(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showSettingsMenu]);

  // Handle click outside settings menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const settingsMenu = document.querySelector('.settings-menu');
      const settingsButton = document.querySelector('.settings-button');
      
      if (settingsMenu && 
          !settingsMenu.contains(event.target as Node) && 
          !settingsButton?.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettingsMenu]);

  // Settings menu UI
  const renderSettingsMenu = () => {
    if (!showSettingsMenu) return null;

    return (
      <div 
        className="settings-menu absolute bottom-20 right-4 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 p-4 w-64 space-y-4 z-50"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          // Reset auto-close timer when user interacts with menu
          const timer = setTimeout(() => {
            setShowSettingsMenu(false);
          }, 5000);
          return () => clearTimeout(timer);
        }}
      >
        {/* Settings Tabs */}
        <div className="flex space-x-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setSettingsTab('quality')}
            className={`px-3 py-1 rounded-lg text-sm ${settingsTab === 'quality' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Quality
          </button>
          <button
            onClick={() => setSettingsTab('speed')}
            className={`px-3 py-1 rounded-lg text-sm ${settingsTab === 'speed' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Speed
          </button>
          {audioTracks.length > 0 && (
            <button
              onClick={() => setSettingsTab('audio')}
              className={`px-3 py-1 rounded-lg text-sm ${settingsTab === 'audio' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Audio
            </button>
          )}
        </div>

        {/* Quality Settings */}
        {settingsTab === 'quality' && (
          <div className="space-y-2">
            <button
              onClick={() => handleQualityChange(-1)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${currentQuality === -1 ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
              <span>Auto</span>
              {currentQuality === -1 && <span className="text-blue-400">✓</span>}
            </button>
            {qualityLevels.map((level) => (
              <button
                key={level.index}
                onClick={() => handleQualityChange(level.index)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${currentQuality === level.index ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                <span>{getQualityLabel(level.height)}</span>
                {currentQuality === level.index && <span className="text-blue-400">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Playback Speed Settings */}
        {settingsTab === 'speed' && (
          <div className="space-y-2">
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  handleSpeedChange(speed);
                  setShowSettingsMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${playbackSpeed === speed ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                <span>{speed === 1 ? 'Normal' : `${speed}x`}</span>
                {playbackSpeed === speed && <span className="text-blue-400">✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Audio Track Settings */}
        {settingsTab === 'audio' && (
          <div className="space-y-2">
            {audioTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => {
                  handleAudioTrackChange(track.id.toString());
                  setShowSettingsMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${selectedAudioTrack === track.id ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                <span>{track.name} ({track.language})</span>
                {selectedAudioTrack === track.id && <span className="text-blue-400">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={playerContainerRef} 
      className="fixed inset-0 z-[200] bg-black"
      tabIndex={0}
      style={{ outline: 'none' }}
      onFocus={() => console.log('Video player focused')}
    >
      {/* Video/Iframe Container */}
      <div 
        className="relative w-full h-full"
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onDoubleClick={handleScreenDoubleClick}
        onClick={() => {
          // Focus the container when clicked to ensure keyboard events work
          if (playerContainerRef.current) {
            playerContainerRef.current.focus();
          }
        }}
      >
        {currentSource?.type === 'hls' ? (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            controls={false}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={currentSource?.url}
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
            onLoad={() => {
              setLoading(false);
              setError(null);
            }}
            onError={() => {
              console.error('Iframe failed to load');
              setError('Video player failed to load. Please try a different source or refresh the page.');
              setLoading(false);
            }}
          />
        )}
        
        {/* Skip Forward Animation */}
        {showForwardAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-pulse">
              <div className="flex items-center gap-2 bg-black/80 text-white px-4 py-2 rounded-lg">
                <SkipForward className="w-6 h-6" />
                <span className="text-sm font-medium">+30s</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Skip Backward Animation */}
        {showBackwardAnimation && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-pulse">
              <div className="flex items-center gap-2 bg-black/80 text-white px-4 py-2 rounded-lg">
                <SkipBack className="w-6 h-6" />
                <span className="text-sm font-medium">-30s</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Skip Intro Button removed */}
        
        {/* Pause Screen Overlay with Logo */}
        {!isPlaying && currentSource?.type === 'hls' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-center mb-8">
              {/* Logo */}
              <img 
                src="/logo.svg" 
                alt="CINEMA.FO" 
                className="h-16 sm:h-20 md:h-24 lg:h-32 w-auto mb-6 transition-all duration-300 filter brightness-110"
              />
              {/* Movie Title */}
              <h2 className="text-white text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold px-4">{title}</h2>
            </div>
          </div>
        )}
        
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-white">Loading video...</p>
            </div>
          </div>
        )}
        
        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center max-w-md">
                              <p className="text-blue-400 mb-4">{error}</p>
              <div className="flex gap-4 justify-center">
              <Button 
                onClick={() => {
                    setRetryCount(prev => prev + 1);
                    fetchStreamUrls();
                }}
                  className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry ({retryCount})
                </Button>
                <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700">
                  Close
              </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Controls Overlay */}
        {showControls && currentSource?.type === 'hls' && (
          <div 
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/80 pointer-events-none"
            style={{ pointerEvents: 'none' }}
          >
            {/* Back Button - Top Left */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-lg transition-all duration-300 pointer-events-auto"
            >
              <ArrowLeft size={20} />
              Back
            </button>

            {/* Movie Title - Top Center */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 text-center pointer-events-auto">
                <h1 className="text-white text-xl font-bold">{title}</h1>
              </div>
              
            {/* Top Right Controls */}
                <div 
              className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
            >
              {/* Empty for now - removed duplicate controls */}
                </div>

            {/* Settings Menu */}
            {renderSettingsMenu()}
            
            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="relative w-full h-2 bg-gray-600 rounded-lg overflow-hidden">
                  {/* Background track */}
                  <div className="absolute inset-0 bg-gray-700 rounded-lg"></div>
                  
                  {/* Gradient progress fill */}
                  <div 
                    className="absolute left-0 top-0 h-full gradient-progress-bar rounded-lg transition-all duration-200"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  ></div>
                  
                  {/* Invisible range input for interaction */}
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                </div>
                <div className="flex justify-between text-sm text-gray-300 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlayPause}
                    className="text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={skipBackward}
                    className="text-white hover:bg-white/20"
                  >
                    <SkipBack className="w-5 h-5" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={skipForward}
                    className="text-white hover:bg-white/20"
                  >
                    <SkipForward className="w-5 h-5" />
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      className="text-white hover:bg-white/20"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <div className="relative w-20 h-2">
                      {/* Background track */}
                      <div className="absolute inset-0 bg-gray-700 rounded-lg"></div>
                      
                      {/* Gradient progress fill */}
                      <div 
                        className="absolute left-0 top-0 h-full gradient-progress-bar rounded-lg transition-all duration-200"
                        style={{ width: `${(volume * 100)}%` }}
                      ></div>
                      
                      {/* Invisible range input for interaction */}
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                  {/* Time Display */}
                  <div className="text-white text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Quality Display */}
                  <div className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                    {currentQuality === -1 ? 'AUTO' : getQualityLabel(qualityLevels[currentQuality]?.height || 1080)}
                  </div>
                  
                  {/* Speed Display */}
                  <div className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                    {playbackSpeed}x
                  </div>

                  {/* Settings Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsMenu(!showSettingsMenu);
                    }}
                    className="settings-button text-white hover:bg-white/20"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="text-white hover:bg-white/20"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </Button>
                </div>
              </div>
            </div>
              </div>
            )}
        
        {/* Iframe Close Button */}
        {currentSource?.type === 'iframe' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-white bg-black/60 hover:bg-black/80"
          >
            <X className="w-6 h-6" />
          </Button>
        )}

        {/* Settings Menu */}
        {renderSettingsMenu()}
      </div>

      {/* Custom Styles are handled via global CSS */}
    </div>
  );
};

export default VideoPlayer; 