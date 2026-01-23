import React, { useState, useEffect, useMemo } from 'react';
import { VideoCard, Video } from './VideoCard';
import { VideoPlayer } from './VideoPlayer';
import { YouTubeService } from '../../services/youtube/youtubeService';

interface VideosProps {
  playlistId?: string; // Legacy: single playlist for all videos
  fallPlaylistId?: string; // New: separate fall semester playlist
  springPlaylistId?: string; // New: separate spring semester playlist
  enrolledSemesters?: string[]; // 'fall', 'spring', or both
}

type SemesterTab = 'fall' | 'spring' | 'all';

export const Videos: React.FC<VideosProps> = ({ playlistId, fallPlaylistId, springPlaylistId, enrolledSemesters }) => {
  const [videoList, setVideoList] = useState<Video[]>([]);
  const [fallVideos, setFallVideos] = useState<Video[]>([]);
  const [springVideos, setSpringVideos] = useState<Video[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'list' | 'player'>('list');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SemesterTab>('spring');
  const useDualPlaylists = !!(fallPlaylistId || springPlaylistId);

  useEffect(() => {
    const fetchPlaylistVideos = async () => {
      setLoading(true);
      setError(null);
      
      console.log('Videos component - Playlist IDs:', {
        playlistId,
        fallPlaylistId,
        springPlaylistId,
        useDualPlaylists
      });
      
      try {
        const youtubeService = YouTubeService.getInstance();
        
        if (useDualPlaylists) {
          // Fetch from separate fall and spring playlists
          console.log('Fetching dual playlists...');
          const [fetchedFallVideos, fetchedSpringVideos] = await Promise.all([
            fallPlaylistId ? youtubeService.getPlaylistVideos(fallPlaylistId) : Promise.resolve([]),
            springPlaylistId ? youtubeService.getPlaylistVideos(springPlaylistId) : Promise.resolve([])
          ]);
          
          console.log('Fetched videos:', {
            fallCount: fetchedFallVideos.length,
            springCount: fetchedSpringVideos.length
          });
          
          setFallVideos(fetchedFallVideos);
          setSpringVideos(fetchedSpringVideos);
          
          if (fetchedFallVideos.length === 0 && fetchedSpringVideos.length === 0) {
            setError('No videos found in playlists.');
          }
        } else if (playlistId) {
          // Legacy: fetch from single playlist
          const fetchedVideos = await youtubeService.getPlaylistVideos(playlistId);
          
          if (fetchedVideos.length > 0) {
            setVideoList(fetchedVideos);
          } else {
            setError('No videos found in this playlist.');
          }
        }
      } catch (err) {
        console.error('Error fetching playlist:', err);
        setError('Failed to load videos. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylistVideos();
  }, [playlistId, fallPlaylistId, springPlaylistId, useDualPlaylists]);

  // Helper function to determine semester based on month
  const getSemester = (date: Date): 'fall' | 'spring' | 'other' => {
    const month = date.getMonth(); // 0-11
    
    // Fall: September (8) - December (11)
    if (month >= 8 && month <= 11) {
      return 'fall';
    }
    // Spring: January (0) - May (4)
    else if (month >= 0 && month <= 4) {
      return 'spring';
    }
    // Other months (Summer)
    else {
      return 'other';
    }
  };

  // Determine which tabs should be visible based on enrollment
  const visibleTabs = useMemo(() => {
    if (!enrolledSemesters || enrolledSemesters.length === 0) {
      // If no enrollment data, show all tabs (admin or default behavior)
      return ['fall', 'spring', 'all'] as SemesterTab[];
    }
    
    const tabs = [...enrolledSemesters] as SemesterTab[];
    if (!tabs.includes('all')) {
      tabs.push('all'); // Always show 'all' tab
    }
    return tabs;
  }, [enrolledSemesters]);

  // Set default active tab to first visible tab
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [visibleTabs, activeTab]);

  // Sort: class videos first (by class number descending), then non-class videos
  const sortVideos = (a: Video, b: Video) => {
    const aIsClass = a.title.toLowerCase().includes('class');
    const bIsClass = b.title.toLowerCase().includes('class');
    
    // If one is class and other isn't, class comes first
    if (aIsClass && !bIsClass) return -1;
    if (!aIsClass && bIsClass) return 1;
    
    // Both are class videos - sort by class number (descending)
    if (aIsClass && bIsClass) {
      const aMatch = a.title.match(/class\s+(\d+)/i);
      const bMatch = b.title.match(/class\s+(\d+)/i);
      const aNum = aMatch ? parseInt(aMatch[1]) : 0;
      const bNum = bMatch ? parseInt(bMatch[1]) : 0;
      return bNum - aNum; // Descending order
    }
    
    // Both non-class videos - sort by date (newest first)
    const dateA = new Date(a.uploadDate || 0);
    const dateB = new Date(b.uploadDate || 0);
    return dateB.getTime() - dateA.getTime();
  };

  // Organize videos by semester
  const organizedVideos = useMemo(() => {
    if (useDualPlaylists) {
      // Use separate playlists for fall and spring
      return {
        fall: [...fallVideos].sort(sortVideos),
        spring: [...springVideos].sort(sortVideos),
        all: [...fallVideos, ...springVideos].sort(sortVideos)
      };
    } else {
      // Legacy: categorize by upload date
      const fall: Video[] = [];
      const spring: Video[] = [];

      videoList.forEach(video => {
        if (video.uploadDate) {
          const uploadDate = new Date(video.uploadDate);

          // Categorize by semester
          const semester = getSemester(uploadDate);
          if (semester === 'fall') {
            fall.push(video);
          } else if (semester === 'spring') {
            spring.push(video);
          }
        }
      });

      return {
        fall: fall.sort(sortVideos),
        spring: spring.sort(sortVideos),
        all: [...videoList].sort(sortVideos)
      };
    }
  }, [videoList, fallVideos, springVideos, useDualPlaylists]);

  // Get current videos based on active tab
  const currentVideos = organizedVideos[activeTab];

  // Show loading state
  if (loading) {
    return (
      <div className="videos-loading">
        <p>Loading videos...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="videos-error">
        <p className="empty">{error}</p>
      </div>
    );
  }

  // If no videos available, show a message
  if (useDualPlaylists) {
    if (fallVideos.length === 0 && springVideos.length === 0) {
      return (
        <p className="empty">No videos available for this course.</p>
      );
    }
  } else if (!videoList || videoList.length === 0) {
    return (
      <p className="empty">No videos available for this course.</p>
    );
  }

  const selectedVideo = currentVideos[selectedVideoIndex];

  const handleVideoSelect = (index: number) => {
    setSelectedVideoIndex(index);
    setViewMode('player');
  };

  const handleNext = () => {
    if (selectedVideoIndex < currentVideos.length - 1) {
      setSelectedVideoIndex(selectedVideoIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (selectedVideoIndex > 0) {
      setSelectedVideoIndex(selectedVideoIndex - 1);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  return (
    <div className="videos-container">
      {viewMode === 'list' ? (
        <div className="videos-list-view">
          <div className="semester-tabs">
            {visibleTabs.includes('fall') && (
              <button
                className={`semester-tab ${activeTab === 'fall' ? 'active' : ''}`}
                onClick={() => setActiveTab('fall')}
              >
                Fall Semester
                {organizedVideos.fall.length > 0 && (
                  <span className="tab-count">{organizedVideos.fall.length}</span>
                )}
              </button>
            )}
            {visibleTabs.includes('spring') && (
              <button
                className={`semester-tab ${activeTab === 'spring' ? 'active' : ''}`}
                onClick={() => setActiveTab('spring')}
              >
                Spring Semester
                {organizedVideos.spring.length > 0 && (
                  <span className="tab-count">{organizedVideos.spring.length}</span>
                )}
              </button>
            )}
            {visibleTabs.includes('all') && (
              <button
                className={`semester-tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All
                <span className="tab-count">{useDualPlaylists ? (fallVideos.length + springVideos.length) : videoList.length}</span>
              </button>
            )}
          </div>

          <div className="videos-header">
            <span className="video-count">{currentVideos.length} videos</span>
          </div>
          
          {currentVideos.length > 0 ? (
            <div className="videos-grid">
              {currentVideos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={() => handleVideoSelect(index)}
                  isActive={selectedVideoIndex === index}
                />
              ))}
            </div>
          ) : (
            <p className="empty">No videos in this category.</p>
          )}
        </div>
      ) : (
        <div className="videos-player-view">
          <button className="back-to-list-btn" onClick={handleBackToList}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Videos
          </button>
          
          <div className="player-and-list">
            <div className="player-section">
              <VideoPlayer
                video={selectedVideo}
                onNext={handleNext}
                onPrevious={handlePrevious}
                hasNext={selectedVideoIndex < currentVideos.length - 1}
                hasPrevious={selectedVideoIndex > 0}
              />
            </div>
            
            <div className="playlist-sidebar">
              <h4>Playlist</h4>
              <div className="playlist-items">
                {currentVideos.map((video, index) => (
                  <div
                    key={video.id}
                    className={`playlist-item ${index === selectedVideoIndex ? 'active' : ''}`}
                    onClick={() => setSelectedVideoIndex(index)}
                  >
                    <div className="playlist-item-number">{index + 1}</div>
                    <div className="playlist-item-info">
                      <h5>{video.title}</h5>
                      {video.duration && <span className="playlist-duration">{video.duration}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};