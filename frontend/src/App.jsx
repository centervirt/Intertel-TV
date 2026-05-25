import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';
import AdminPanel from './AdminPanel';
import AdultUnlockModal from './AdultUnlockModal';
import ProfileSelector from './ProfileSelector';

const API_URL = '/api';

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getEpgProgress = (startStr, stopStr) => {
  if (!startStr || !stopStr) return 0;
  const start = new Date(startStr).getTime();
  const stop = new Date(stopStr).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= stop) return 100;
  return Math.round(((now - start) / (stop - start)) * 100);
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};


const theme = {
  bg: '#0a0a0f',
  surface: '#0e0e18',
  border: 'rgba(255,255,255,0.06)',
  accent: '#4fc3f7',
  text: '#e2e0f0',
  text2: '#9896b0',
  text3: '#55546a',
  gradient: 'radial-gradient(circle at center, #1a1a2e 0%, #0a0a0f 100%)',
};

const styles = {
  input: {
    width: '100%',
    padding: '12px 16px',
    marginBottom: '16px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    color: '#e2e0f0',
    outline: 'none',
    fontSize: '15px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4fc3f7',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '15px',
    transition: 'opacity 0.2s',
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [settings, setSettings] = useState({ isp_name: 'Intertel-TV', isp_logo: '' });
  const [view, setView] = useState('all'); // all, favorites, group, admin
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [channels, setChannels] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingChannel, setPlayingChannel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loaderRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [adultToken, setAdultToken] = useState(localStorage.getItem('adultToken'));
  const [adultUnlockedUntil, setAdultUnlockedUntil] = useState(localStorage.getItem('adultUnlockedUntil'));
  const [familyMode, setFamilyMode] = useState(localStorage.getItem('familyMode') === 'true');
  const [showAdultModal, setShowAdultModal] = useState(false);
  const [profile, setProfile] = useState(JSON.parse(localStorage.getItem('profile')));
  const [profileToken, setProfileToken] = useState(localStorage.getItem('profileToken'));
  const [pendingChannel, setPendingChannel] = useState(null);
  const [playerUiVisible, setPlayerUiVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [pendingGroup, setPendingGroup] = useState(null);
  const [miniGuideOpen, setMiniGuideOpen] = useState(false);
  const playerUiTimerRef = useRef(null);

  // VOD (Video on Demand) States
  const [vodContent, setVodContent] = useState([]);
  const [selectedVod, setSelectedVod] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [vodEpisodes, setVodEpisodes] = useState([]);
  const [playingVod, setPlayingVod] = useState(null);
  const [loadingVodEpisodes, setLoadingVodEpisodes] = useState(false);
  const [vodSearchQuery, setVodSearchQuery] = useState('');

  const showPlayerUi = () => {
    setPlayerUiVisible(true);
    if (playerUiTimerRef.current) clearTimeout(playerUiTimerRef.current);
    if (miniGuideOpen) return; // Do not hide UI when mini-guide is open
    playerUiTimerRef.current = setTimeout(() => {
      setPlayerUiVisible(false);
    }, 3500);
  };


  useEffect(() => {
    if (playingChannel || playingVod) {
      showPlayerUi();
    } else {
      if (playerUiTimerRef.current) clearTimeout(playerUiTimerRef.current);
      setMiniGuideOpen(false);
    }
  }, [playingChannel, playingVod]);

  useEffect(() => {
    if (miniGuideOpen) {
      setPlayerUiVisible(true);
      if (playerUiTimerRef.current) clearTimeout(playerUiTimerRef.current);
    } else if (playingChannel || playingVod) {
      showPlayerUi();
    }
  }, [miniGuideOpen, playingChannel, playingVod]);


  const isAdultUnlocked = () => {
    // If we are in an adult profile, content is considered unlocked
    if (profile?.type === 'adult') return true;
    // Otherwise, check for temporary session token
    if (adultToken && adultUnlockedUntil && Date.now() < parseInt(adultUnlockedUntil)) return true;
    return false;
  };

  const handleAdultUnlock = (token, minutes) => {
    const until = Date.now() + (minutes * 60 * 1000);
    setAdultToken(token);
    setAdultUnlockedUntil(until);
    localStorage.setItem('adultToken', token);
    localStorage.setItem('adultUnlockedUntil', until);
    
    // Refresh data with adult channels
    fetchData(false, token);
    
    // If we were trying to play a channel, do it now
    if (pendingChannel) {
      playChannel(pendingChannel);
      setPendingChannel(null);
    } else if (pendingGroup) {
      setView('group');
      setSelectedGroup(pendingGroup);
      setPendingGroup(null);
      setShowCategoriesModal(false);
    }
  };

  useEffect(() => {
    // Spatial Navigation & Player Controls for Android TV
    const handleKeyDown = (e) => {
      // Allow native behavior for inputs (typing, deleting, moving cursor)
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (['Escape', 'GoBack'].includes(e.key) || e.keyCode === 27) {
          // Let Escape blur the input so user can navigate the page again
          document.activeElement.blur();
          return;
        }
        // Don't intercept any other keys while typing
        return;
      }

      if (showCategoriesModal) {
        if (['Escape', 'Backspace', 'GoBack'].includes(e.key) || e.keyCode === 27 || e.keyCode === 8) {
          e.preventDefault();
          setShowCategoriesModal(false);
          return;
        }
      }

      if (selectedVod) {
        if (['Escape', 'Backspace', 'GoBack'].includes(e.key) || e.keyCode === 27 || e.keyCode === 8) {
          e.preventDefault();
          setSelectedVod(null);
          return;
        }
      }

      if (playingVod) {
        showPlayerUi();
        if (['Escape', 'Backspace', 'GoBack'].includes(e.key) || e.keyCode === 27 || e.keyCode === 8) {
          e.preventDefault();
          if (hlsRef.current) hlsRef.current.destroy();
          setPlayingVod(null);
          return;
        }
      }

      if (playingChannel) {
        showPlayerUi();
        
        if (['Escape', 'Backspace', 'GoBack'].includes(e.key) || e.keyCode === 27 || e.keyCode === 8) {
          e.preventDefault();
          if (miniGuideOpen) {
            setMiniGuideOpen(false);
            const exitBtn = document.querySelector('.player-header button');
            if (exitBtn) exitBtn.focus();
          } else {
            if (hlsRef.current) hlsRef.current.destroy();
            setPlayingChannel(null);
          }
          return;
        }

        if (e.key === 'ArrowLeft' && !miniGuideOpen) {
          e.preventDefault();
          setMiniGuideOpen(true);
          setTimeout(() => {
            const activeItem = document.querySelector('.mini-guide-channel-item.active') || document.querySelector('.mini-guide-channel-item[tabindex="0"]');
            if (activeItem) {
              activeItem.focus();
              activeItem.scrollIntoView({ block: 'center' });
            }
          }, 100);
          return;
        }

        if (e.key === 'ArrowRight' && miniGuideOpen) {
          e.preventDefault();
          setMiniGuideOpen(false);
          const exitBtn = document.querySelector('.player-header button');
          if (exitBtn) exitBtn.focus();
          return;
        }

        if (['ArrowUp', 'ArrowDown'].includes(e.key) && !miniGuideOpen) {
          e.preventDefault();
          const currentIndex = channels.findIndex(c => c.id === playingChannel.id);
          if (currentIndex !== -1) {
            let nextIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
            if (nextIndex < 0) nextIndex = channels.length - 1;
            if (nextIndex >= channels.length) nextIndex = 0;
            const nextChannel = channels[nextIndex];
            
            if (nextChannel.is_adult === 1 && !isAdultUnlocked()) {
              if (hlsRef.current) hlsRef.current.destroy();
              setPlayingChannel(null);
              setPendingChannel(nextChannel);
              setShowAdultModal(true);
            } else {
              playChannel(nextChannel);
            }
          }
          return;
        }
      }

      const active = document.activeElement;
      if (!active) return;

      if (e.key === 'Enter') {
        if (active.tagName === 'DIV' || active.tagName === 'BUTTON') {
          active.click();
        }
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        let focusables;
        if (showCategoriesModal) {
          focusables = Array.from(document.querySelectorAll('.categories-modal-overlay [tabindex="0"], .categories-modal-overlay button'));
        } else if (playingChannel || playingVod) {
          focusables = Array.from(document.querySelectorAll('.player-overlay [tabindex="0"], .player-overlay button'));
        } else if (selectedVod) {
          focusables = Array.from(document.querySelectorAll('.vod-details-overlay [tabindex="0"], .vod-details-overlay button'));
        } else {
          focusables = Array.from(document.querySelectorAll('[tabindex="0"], button, input, select')).filter(el => {
            return !el.closest('.categories-modal-overlay') && !el.closest('.player-overlay') && !el.closest('.vod-details-overlay');
          });
        }

        const activeRect = active.getBoundingClientRect();
        
        let bestElement = null;
        let minDistance = Infinity;

        focusables.forEach(el => {
          if (el === active) return;
          const rect = el.getBoundingClientRect();
          
          const dx = rect.left + rect.width / 2 - (activeRect.left + activeRect.width / 2);
          const dy = rect.top + rect.height / 2 - (activeRect.top + activeRect.height / 2);
          const distance = Math.sqrt(dx * dx + dy * dy);

          let isValidDirection = false;
          if (e.key === 'ArrowUp' && rect.bottom <= activeRect.top + 5) isValidDirection = true;
          if (e.key === 'ArrowDown' && rect.top >= activeRect.bottom - 5) isValidDirection = true;
          if (e.key === 'ArrowLeft' && rect.right <= activeRect.left + 5) isValidDirection = true;
          if (e.key === 'ArrowRight' && rect.left >= activeRect.right - 5) isValidDirection = true;

          if (isValidDirection && distance < minDistance) {
            minDistance = distance;
            bestElement = el;
          }
        });

        if (bestElement) {
          e.preventDefault();
          bestElement.focus();
          bestElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, groups, view, playingChannel, playingVod, selectedVod, profile, adultToken, adultUnlockedUntil, showCategoriesModal, miniGuideOpen]);

  useEffect(() => {
    // Check for adult timeout periodically
    const timer = setInterval(() => {
      if (adultToken && !isAdultUnlocked()) {
        setAdultToken(null);
        setAdultUnlockedUntil(null);
        localStorage.removeItem('adultToken');
        localStorage.removeItem('adultUnlockedUntil');
        if (view === 'group' && selectedGroup === 'Adultos') {
          setView('all');
        }
        fetchData(false);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [adultToken, adultUnlockedUntil, familyMode]);

  useEffect(() => {
    fetch(`${API_URL}/settings`)
      .then(res => res.json())
      .then(data => setSettings(prev => ({ ...prev, ...data })))
      .catch(err => console.error('Error loading settings:', err));
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      // Validate token format — JWT starts with 'eyJ', old Base64 tokens don't
      if (!token.startsWith('eyJ')) {
        // Old token format detected — force re-login
        localStorage.clear();
        setToken(null);
        setUser(null);
        setProfile(null);
        setProfileToken(null);
        return;
      }
      setUser(JSON.parse(savedUser));
    }
  }, [token]);

  useEffect(() => {
    if (user && profileToken) {
      if (view === 'movies' || view === 'series') {
        setVodSearchQuery(''); // Reset VOD search when switching views
        fetchVodData();
      } else if (view !== 'admin') {
        setPage(1);
        fetchData(false);
      }
    }
  }, [user, view, selectedGroup, profileToken]);

  useEffect(() => {
    if (page > 1) {
      fetchData(true);
    }
  }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading && view !== 'favorites') {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, view]);

  const fetchData = async (isLoadMore = false, forceAdultToken = null) => {
    if (!token) return;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const currentAdultToken = forceAdultToken || (isAdultUnlocked() ? adultToken : null);
      const config = { 
        headers: { 
          'x-auth-token': token,
          'x-adult-token': currentAdultToken,
          'x-profile-token': profileToken
        } 
      };
      
      if (!isLoadMore) {
        const statsRes = await axios.get(`${API_URL}/channels/stats`, config);
        setStats(statsRes.data);

        const groupsRes = await axios.get(`${API_URL}/channels/groups`, config);
        setGroups(groupsRes.data);

        const favRes = await axios.get(`${API_URL}/favorites`, config);
        setFavorites(favRes.data);
      }

      if (view === 'favorites') {
        const favRes = await axios.get(`${API_URL}/favorites`, config);
        setChannels(favRes.data);
        setHasMore(false);
      } else {
        const p = isLoadMore ? page : 1;
        let url = `${API_URL}/channels?search=${search}&page=${p}&limit=40`;
        if (view === 'group' && selectedGroup) {
          url += `&group=${encodeURIComponent(selectedGroup)}`;
        }
        
        const chanRes = await axios.get(url, config);
        const newChannels = chanRes.data.channels;
        
        if (isLoadMore) {
          setChannels(prev => [...prev, ...newChannels]);
        } else {
          setChannels(newChannels);
        }
        setHasMore(chanRes.data.pagination.hasMore);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchVodData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const config = { 
        headers: { 
          'x-auth-token': token,
          'x-profile-token': profileToken
        } 
      };
      const res = await axios.get(`${API_URL}/vod/home`, config);
      setVodContent(res.data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar catálogo VoD');
    } finally {
      setLoading(false);
    }
  };

  const handleVodSearch = async () => {
    if (!token) return;
    if (!vodSearchQuery.trim()) {
      fetchVodData();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const config = { 
        headers: { 
          'x-auth-token': token,
          'x-profile-token': profileToken
        } 
      };
      const res = await axios.get(`${API_URL}/vod/search?q=${encodeURIComponent(vodSearchQuery)}`, config);
      setVodContent([
        {
          category: `Resultados para "${vodSearchQuery}"`,
          items: res.data
        }
      ]);
    } catch (err) {
      console.error(err);
      setError('Error en la búsqueda');
    } finally {
      setLoading(false);
    }
  };

  const handleVodSelect = async (item) => {
    setLoading(true);
    setError(null);
    try {
      const config = { 
        headers: { 
          'x-auth-token': token,
          'x-profile-token': profileToken
        } 
      };
      const res = await axios.get(`${API_URL}/vod/info/${item.type}/${item.id}`, config);
      setSelectedVod(res.data);
      setActiveSeason(null);
      setVodEpisodes([]);
      
      // If it's a TV show, automatically select season 1 if available
      if (item.type === 'tv' && res.data.seasons && res.data.seasons.length > 0) {
        const firstSeasonNum = res.data.seasons[0].season_number;
        handleSeasonSelect(res.data.id, firstSeasonNum);
      }
    } catch (err) {
      console.error(err);
      setError('Error al obtener detalles del contenido');
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonSelect = async (tvId, seasonNumber) => {
    setActiveSeason(seasonNumber);
    setLoadingVodEpisodes(true);
    try {
      const config = { 
        headers: { 
          'x-auth-token': token,
          'x-profile-token': profileToken
        } 
      };
      const res = await axios.get(`${API_URL}/vod/info/tv/${tvId}/season/${seasonNumber}`, config);
      setVodEpisodes(res.data);
    } catch (err) {
      console.error(err);
      setVodEpisodes([]);
    } finally {
      setLoadingVodEpisodes(false);
    }
  };

  const playVod = async (type, id, season = null, episode = null, name = '') => {
    setLoading(true);
    setError(null);
    try {
      const config = { 
        headers: { 
          'x-auth-token': token,
          'x-profile-token': profileToken
        } 
      };
      let url = `${API_URL}/vod/stream/${type}/${id}`;
      if (season !== null && episode !== null) {
        url += `?season=${season}&episode=${episode}`;
      }
      const res = await axios.get(url, config);
      
      setPlayingVod({
        ...res.data,
        title: selectedVod.title,
        subtitle: type === 'tv' ? `T${season} • E${episode} - ${name}` : selectedVod.year,
        currentAlternativeIndex: 0
      });
      setSelectedVod(null);
    } catch (err) {
      console.error(err);
      setError('Error al iniciar la reproducción');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    try {
      const res = await axios.post(`${API_URL}/login`, { username, password });
      // Normalize: backend returns isAdmin (bool), we store as is_admin for consistency
      const userData = { ...res.data, is_admin: res.data.isAdmin ? 1 : 0 };
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(res.data.token);
      setUser(userData);
    } catch (err) {
      alert('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
    localStorage.removeItem('profileToken');
    localStorage.removeItem('adultToken');
    localStorage.removeItem('adultUnlockedUntil');
    setToken(null);
    setUser(null);
    setProfile(null);
    setProfileToken(null);
    setView('all');
  };

  const handleProfileSelect = (prof, profToken) => {
    // Clear adult session on profile switch for security
    setAdultToken(null);
    setAdultUnlockedUntil(null);
    localStorage.removeItem('adultToken');
    localStorage.removeItem('adultUnlockedUntil');
    
    setProfile(prof);
    setProfileToken(profToken);
    localStorage.setItem('profile', JSON.stringify(prof));
    localStorage.setItem('profileToken', profToken);
  };

  const toggleFavorite = async (e, channelId) => {
    e.stopPropagation();
    const config = { 
      headers: { 
        'x-auth-token': token,
        'x-profile-token': profileToken
      } 
    };
    const isFav = favorites.some(f => f.id === channelId);
    try {
      if (isFav) {
        await axios.delete(`${API_URL}/favorites/${channelId}`, config);
      } else {
        await axios.post(`${API_URL}/favorites/${channelId}`, {}, config);
      }
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const playChannel = (channel) => {
    setPlayingChannel(channel);
    setError(null);
    setLoading(true);
  };

  useEffect(() => {
    let interval;
    if (playingChannel && !loading && !error) {
      interval = setInterval(() => {
        fetch(`${API_URL}/track`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'x-auth-token': token,
            'x-profile-token': profileToken
          },
          body: JSON.stringify({ channelId: playingChannel.id, eventType: 'heartbeat', durationSec: 60 })
        });
      }, 60000); // 1 minute
    }
    return () => clearInterval(interval);
  }, [playingChannel, loading, error]);

  useEffect(() => {
    if (playingChannel) {
      const ytId = getYouTubeId(playingChannel.url);
      if (ytId) {
        setLoading(false);
        setError(null);
        // Track play
        fetch(`${API_URL}/track`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'x-auth-token': token,
            'x-profile-token': profileToken
          },
          body: JSON.stringify({ channelId: playingChannel.id, eventType: 'play' })
        });
        return;
      }

      if (videoRef.current) {
        const video = videoRef.current;
        if (Hls.isSupported()) {
          if (hlsRef.current) hlsRef.current.destroy();
          
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 60,
            manifestLoadingMaxRetry: 5,
            manifestLoadingRetryDelay: 1000,
            levelLoadingMaxRetry: 5,
            levelLoadingRetryDelay: 1000,
            fragLoadingMaxRetry: 5,
            fragLoadingRetryDelay: 1000,
          });

          hls.loadSource(playingChannel.url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.error('Auto-play blocked:', e));
            setLoading(false);
            // Track play
            fetch(`${API_URL}/track`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'x-auth-token': token,
                'x-profile-token': profileToken
              },
              body: JSON.stringify({ channelId: playingChannel.id, eventType: 'play' })
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              // Track error
              fetch(`${API_URL}/track`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json', 
                  'x-auth-token': token,
                  'x-profile-token': profileToken
                },
                body: JSON.stringify({ channelId: playingChannel.id, eventType: 'error' })
              });

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  setError('Error de red. Reintentando...');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  setError('Error de medios. Recuperando...');
                  hls.recoverMediaError();
                  break;
                default:
                  setError('Error crítico de reproducción');
                  hls.destroy();
                  break;
              }
            }
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = playingChannel.url;
          video.addEventListener('loadedmetadata', () => {
            video.play();
            setLoading(false);
          });
        }
      }
    }
  }, [playingChannel]);

  if (!user) {
    return (
      <div className="login-container">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-logo">
            {settings.isp_logo && <img src={settings.isp_logo} className="login-logo-img" alt="" />}
            <div>{settings.isp_name}</div>
          </div>
          <input name="username" style={styles.input} placeholder="Usuario" required />
          <input name="password" style={styles.input} type="password" placeholder="Contraseña" required />
          <button style={styles.button}>INGRESAR</button>
        </form>
      </div>
    );
  }

  if (!profileToken) {
    return (
      <ProfileSelector 
        token={token} 
        API_URL={API_URL} 
        onProfileSelect={handleProfileSelect}
        theme={theme}
      />
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            ☰
          </button>
          {settings.isp_logo && <img src={settings.isp_logo} style={{ height: '30px', marginRight: '10px' }} alt="" />}
          {settings.isp_name}
        </div>
        <div className="header-right">
          <div className="current-profile-pill" onClick={() => {
            setProfile(null);
            setProfileToken(null);
            localStorage.removeItem('profile');
            localStorage.removeItem('profileToken');
          }}>
            <span className="profile-pill-avatar">{profile?.type === 'kids' || profile?.access_level <= 1 ? '👶' : '🧔'}</span>
            <span className="profile-pill-name">{profile?.name}</span>
            <span className="profile-pill-change">(CAMBIAR)</span>
          </div>
          <div className="stats-badge">
            <span className="stats-number">{stats?.total || 0}</span> Canales | <span className="stats-number"> {stats?.groups || 0}</span> Categorías
          </div>
          {user.is_admin === 1 && (
            <button 
              onClick={() => setView('admin')}
              className="btn btn-secondary"
            >
              ADMIN
            </button>
          )}
          <button 
            onClick={handleLogout}
            className="btn btn-danger"
          >
            SALIR
          </button>
        </div>
      </header>

      <aside className={`app-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-search">
          <input 
            className="search-input"
            placeholder={ (view === 'movies' || view === 'series') ? "Buscar películas/series..." : "Buscar canal..." }
            value={ (view === 'movies' || view === 'series') ? vodSearchQuery : search }
            onChange={(e) => {
              if (view === 'movies' || view === 'series') {
                setVodSearchQuery(e.target.value);
              } else {
                setSearch(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (view === 'movies' || view === 'series') {
                  handleVodSearch();
                } else {
                  fetchData();
                }
              }
            }}
          />
        </div>
        
        <div 
          tabIndex="0"
          onClick={() => { setView('all'); setSelectedGroup(null); setIsMobileMenuOpen(false); }}
          className={`sidebar-item ${view === 'all' && !selectedGroup ? 'active' : ''}`}
        >
          <span>📺 Todos los canales</span>
        </div>
        <div 
          tabIndex="0"
          onClick={() => { setView('favorites'); setIsMobileMenuOpen(false); }}
          className={`sidebar-item ${view === 'favorites' ? 'active' : ''}`}
        >
          <span>★ Favoritos</span>
          <span className="sidebar-count">{favorites.length}</span>
        </div>
        <div 
          tabIndex="0"
          onClick={() => { setView('movies'); setIsMobileMenuOpen(false); }}
          className={`sidebar-item ${view === 'movies' ? 'active' : ''}`}
        >
          <span>🎬 Películas</span>
        </div>
        <div 
          tabIndex="0"
          onClick={() => { setView('series'); setIsMobileMenuOpen(false); }}
          className={`sidebar-item ${view === 'series' ? 'active' : ''}`}
        >
          <span>🍿 Series</span>
        </div>

        {user.is_admin === 1 && (
          <div 
            tabIndex="0"
            onClick={() => { setView('admin'); setSelectedGroup(null); setIsMobileMenuOpen(false); }}
            className={`sidebar-item ${view === 'admin' ? 'active' : ''}`}
          >
            <span>⚙️ Panel Administrador</span>
          </div>
        )}

        <div className="sidebar-section-title">
          <span>OPCIONES</span>
        </div>

        <div 
          tabIndex="0"
          onClick={() => {
            const newValue = !familyMode;
            setFamilyMode(newValue);
            localStorage.setItem('familyMode', newValue);
            if (newValue) {
              setAdultToken(null);
              setAdultUnlockedUntil(null);
              localStorage.removeItem('adultToken');
              localStorage.removeItem('adultUnlockedUntil');
              if (selectedGroup === 'Adultos') { setView('all'); setSelectedGroup(null); }
            }
            fetchData(false);
          }}
          className={`sidebar-item ${familyMode ? 'active' : ''}`}
          style={familyMode ? { color: 'var(--accent)' } : {}}
        >
          <span>👨‍👩‍👧‍👦 Modo Familiar</span>
          <span className="sidebar-count" style={{ fontSize: '10px' }}>
            {familyMode ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>

        {/* Mobile session actions */}
        <div className="sidebar-mobile-actions">
          <div className="sidebar-section-title">
            <span>PERFIL</span>
          </div>
          <div 
            tabIndex="0"
            onClick={() => {
              setProfile(null);
              setProfileToken(null);
              localStorage.removeItem('profile');
              localStorage.removeItem('profileToken');
              setIsMobileMenuOpen(false);
            }}
            className="sidebar-item"
          >
            <span>👤 Cambiar Perfil ({profile?.name})</span>
          </div>
          {user.is_admin === 1 && (
            <div 
              tabIndex="0"
              onClick={() => { setView('admin'); setIsMobileMenuOpen(false); }}
              className={`sidebar-item ${view === 'admin' ? 'active' : ''}`}
            >
              <span>⚙️ Panel Administrador</span>
            </div>
          )}
          <div 
            tabIndex="0"
            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
            className="sidebar-item"
            style={{ color: 'var(--danger)' }}
          >
            <span>🚪 Cerrar Sesión</span>
          </div>
        </div>
      </aside>

      <main className="app-main">
        {view === 'admin' ? (
          <AdminPanel token={token} API_URL={API_URL} theme={theme} styles={styles} />
        ) : (view === 'movies' || view === 'series') ? (
          <>
            <h1 className="main-title">
              {view === 'movies' ? '🎬 Películas a la Carta' : '🍿 Series y Documentales'}
              {vodSearchQuery && <span className="main-title-count"> Búsqueda: "{vodSearchQuery}"</span>}
            </h1>
            
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent)' }}>
                Cargando catálogo...
              </div>
            ) : (
              <div className="vod-catalog">
                {vodSearchQuery && vodContent.length > 0 ? (
                  <div className="vod-grid">
                    {vodContent[0].items.filter(i => i.type === (view === 'movies' ? 'movie' : 'tv')).map(item => (
                      <div 
                        key={item.id} 
                        className="vod-card" 
                        tabIndex="0"
                        onClick={() => handleVodSelect(item)}
                      >
                        {item.poster ? (
                          <img src={item.poster} alt={item.title} loading="lazy" />
                        ) : (
                          <div className="vod-card-overlay" style={{ opacity: 1, background: '#10101c', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                            <span className="vod-card-title">{item.title}</span>
                          </div>
                        )}
                        <div className="vod-card-overlay">
                          <div className="vod-card-title">{item.title}</div>
                          <div className="vod-card-info">
                            <span className="vod-card-rating">⭐ {item.rating ? item.rating.toFixed(1) : 'N/A'}</span>
                            <span>{item.year}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  vodContent.map((cat, idx) => {
                    const filteredItems = cat.items.filter(i => i.type === (view === 'movies' ? 'movie' : 'tv'));
                    if (filteredItems.length === 0) return null;
                    return (
                      <div key={idx} className="vod-row-container">
                        <h2 className="vod-row-title">{cat.category}</h2>
                        <div className="vod-row-slider">
                          {filteredItems.map(item => (
                            <div 
                              key={item.id} 
                              className="vod-card" 
                              tabIndex="0"
                              onClick={() => handleVodSelect(item)}
                            >
                              {item.poster ? (
                                <img src={item.poster} alt={item.title} loading="lazy" />
                              ) : (
                                <div className="vod-card-overlay" style={{ opacity: 1, background: '#10101c', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                                  <span className="vod-card-title">{item.title}</span>
                                </div>
                              )}
                              <div className="vod-card-overlay">
                                <div className="vod-card-title">{item.title}</div>
                                <div className="vod-card-info">
                                  <span className="vod-card-rating">⭐ {item.rating ? item.rating.toFixed(1) : 'N/A'}</span>
                                  <span>{item.year}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
                {vodContent.length === 0 || !vodContent.some(cat => cat.items.some(i => i.type === (view === 'movies' ? 'movie' : 'tv'))) ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No se encontraron contenidos.
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="main-title">
              {view === 'favorites' ? 'Mis Favoritos' : selectedGroup || 'Todos los canales'}
              <span className="main-title-count">{channels.length} canales</span>
            </h1>

            {/* Barra de Categorías Horizontal */}
            <div className="categories-container">
              <button 
                className="explore-categories-btn" 
                onClick={() => setShowCategoriesModal(true)}
                title="Explorar todas las categorías"
                tabIndex="0"
              >
                🧭
              </button>
              
              <div className="categories-bar">
                <div 
                  tabIndex="0"
                  onClick={() => { setView('all'); setSelectedGroup(null); }}
                  className={`category-pill ${view === 'all' && !selectedGroup ? 'active' : ''}`}
                >
                  📺 Todos <span className="category-pill-count">{stats?.total || 0}</span>
                </div>
                
                {groups.map(g => {
                  const isAdultGroup = g.group_title === 'Adultos' || g.group_title === 'XXX' || g.group_title?.toUpperCase().includes('ADULT');
                  const isActive = view === 'group' && selectedGroup === g.group_title;
                  
                  // Asignación de icono según el nombre
                  let icon = '📁';
                  const titleLower = g.group_title?.toLowerCase() || '';
                  if (titleLower.includes('cine') || titleLower.includes('película') || titleLower.includes('movie') || titleLower.includes('cinema')) icon = '🎬';
                  else if (titleLower.includes('serie') || titleLower.includes('show')) icon = '🍿';
                  else if (titleLower.includes('deporte') || titleLower.includes('sport') || titleLower.includes('futbol') || titleLower.includes('soccer')) icon = '⚽';
                  else if (titleLower.includes('noticia') || titleLower.includes('news')) icon = '📰';
                  else if (titleLower.includes('infantil') || titleLower.includes('niño') || titleLower.includes('kid')) icon = '👶';
                  else if (titleLower.includes('documental') || titleLower.includes('docu') || titleLower.includes('history')) icon = '📜';
                  else if (titleLower.includes('música') || titleLower.includes('music')) icon = '🎵';
                  else if (titleLower.includes('entretenimiento') || titleLower.includes('varios')) icon = '🎭';
                  else if (isAdultGroup) icon = '🔒';

                  return (
                    <div 
                      key={g.group_title}
                      tabIndex="0"
                      onClick={() => {
                        if (isAdultGroup && !isAdultUnlocked()) {
                          setPendingGroup(g.group_title);
                          setShowAdultModal(true);
                        } else {
                          setView('group');
                          setSelectedGroup(g.group_title);
                        }
                      }}
                      className={`category-pill ${isActive ? 'active' : ''}`}
                      style={g.group_title === 'Adultos' ? { color: 'var(--danger)' } : {}}
                    >
                      {icon} {g.group_title || 'Sin grupo'}
                      <span className="category-pill-count">{g.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="channel-grid">
              {channels.map(ch => (
                <div 
                  key={`${ch.id}-${ch.name}`} 
                  tabIndex="0"
                  className={`channel-card ${ch.status || ''}`}
                  onClick={() => {
                    if (ch.is_adult === 1 && !isAdultUnlocked()) {
                      setPendingChannel(ch);
                      setShowAdultModal(true);
                    } else {
                      playChannel(ch);
                    }
                  }}
                >
                  <button 
                    tabIndex="-1"
                    className={`favorite-btn ${favorites.some(f => f.id === ch.id) ? 'active' : ''}`}
                    onClick={(e) => toggleFavorite(e, ch.id)}
                  >
                    ★
                  </button>
                  <div className="channel-logo-container">
                    {ch.logo ? (
                      <img src={ch.logo} className="channel-logo-img" alt={ch.name} loading="lazy" onError={(e) => e.target.style.display = 'none'} />
                    ) : (
                      <span className="channel-logo-fallback">{ch.name[0]}</span>
                    )}
                  </div>
                  <div className="channel-card-name">
                    {ch.is_adult === 1 && <span className="adult-badge">+18</span>}
                    {ch.status === 'maintenance' && <span className="status-dot maintenance" title="Mantenimiento" />}
                    {ch.status === 'unstable' && <span className="status-dot unstable" title="Inestable" />}
                    {ch.status === 'warning' && <span className="status-dot unstable" title="Intermitente" />}
                    {ch.name}
                  </div>
                  <div 
                    className="channel-card-group"
                    style={{ color: (ch.status === 'maintenance' || ch.is_online === 0) ? 'var(--danger)' : (ch.status === 'unstable' ? 'var(--warning)' : 'var(--text-secondary)') }}
                  >
                    {ch.status === 'maintenance' ? 'TEMPORALMENTE NO DISPONIBLE' : (ch.status === 'unstable' ? 'CONEXIÓN INESTABLE' : (ch.is_online === 0 ? 'FUERA DE LÍNEA' : ch.group_title))}
                  </div>
                  {ch.epg && (
                    <div className="epg-info">
                      <div className="epg-title" title={ch.epg.description || ch.epg.title}>
                        {ch.epg.title}
                      </div>
                      <div className="epg-time-container">
                        <span>{formatTime(ch.epg.start)} - {formatTime(ch.epg.stop)}</span>
                        <span>{getEpgProgress(ch.epg.start, ch.epg.stop)}%</span>
                      </div>
                      <div className="epg-progress-bar">
                        <div 
                          className="epg-progress-fill" 
                          style={{ width: `${getEpgProgress(ch.epg.start, ch.epg.stop)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {hasMore && (
              <div ref={loaderRef} style={{ padding: '40px', textAlign: 'center', color: 'var(--accent)' }}>
                {loadingMore ? 'Cargando más canales...' : 'Desliza para ver más'}
              </div>
            )}
          </>
        )}
      </main>

      {playingChannel && (
        <div 
          className="player-overlay"
          style={{ cursor: (playerUiVisible || miniGuideOpen) ? 'default' : 'none' }}
          onMouseMove={showPlayerUi}
          onClick={(e) => {
            if (miniGuideOpen && !e.target.closest('.player-mini-guide')) {
              setMiniGuideOpen(false);
            } else {
              showPlayerUi();
            }
          }}
        >
          {getYouTubeId(playingChannel.url) && (
            <button 
              onClick={() => { if (hlsRef.current) hlsRef.current.destroy(); setPlayingChannel(null); }}
              className="player-mobile-back-btn"
              title="Volver"
            >
              ✕
            </button>
          )}
          <div 
            className="player-header"
            style={{ 
              opacity: (playerUiVisible || miniGuideOpen) ? 1 : 0, 
              pointerEvents: (playerUiVisible || miniGuideOpen) ? 'auto' : 'none'
            }}
          >
            <div className="player-channel-info">
              <img src={playingChannel.logo} className="player-logo" alt="" />
              <div>
                <div className="player-title">{playingChannel.name}</div>
                <div className="player-subtitle">
                  <span>EN VIVO • {playingChannel.group_title}</span>
                  <span className="player-zap-hint">(Usa flechas ▼▲ para zapping, ◄ para Mini-Guía)</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => { if (hlsRef.current) hlsRef.current.destroy(); setPlayingChannel(null); }}
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '8px 20px' }}
            >
              SALIR (Atrás)
            </button>
          </div>

          {/* Mini-Guía Lateral */}
          <aside className={`player-mini-guide ${miniGuideOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="mini-guide-header">
              <div className="mini-guide-title">
                <span>📺 Mini-Guía</span>
              </div>
              <div className="mini-guide-categories">
                <div 
                  tabIndex={miniGuideOpen ? "0" : "-1"}
                  onClick={() => { setView('all'); setSelectedGroup(null); }}
                  className={`mini-guide-category-pill ${view === 'all' && !selectedGroup ? 'active' : ''}`}
                >
                  Todos
                </div>
                {groups.map(g => {
                  const isAdultGroup = g.group_title === 'Adultos' || g.group_title === 'XXX' || g.group_title?.toUpperCase().includes('ADULT');
                  const isActive = view === 'group' && selectedGroup === g.group_title;
                  if (isAdultGroup && !isAdultUnlocked()) return null; // Ocultar categoría adultos si está bloqueada
                  
                  return (
                    <div 
                      key={`mini-g-${g.group_title}`}
                      tabIndex={miniGuideOpen ? "0" : "-1"}
                      onClick={() => {
                        setView('group');
                        setSelectedGroup(g.group_title);
                      }}
                      className={`mini-guide-category-pill ${isActive ? 'active' : ''}`}
                    >
                      {g.group_title}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mini-guide-channels-list">
              {channels.map(ch => {
                const isActive = playingChannel.id === ch.id;
                return (
                  <div 
                    key={`mini-ch-${ch.id}`}
                    tabIndex={miniGuideOpen ? "0" : "-1"}
                    className={`mini-guide-channel-item ${isActive ? 'active' : ''}`}
                    style={isActive ? { borderColor: 'var(--accent)', background: 'rgba(79, 195, 247, 0.1)' } : {}}
                    onClick={() => {
                      if (ch.is_adult === 1 && !isAdultUnlocked()) {
                        if (hlsRef.current) hlsRef.current.destroy();
                        setPlayingChannel(null);
                        setPendingChannel(ch);
                        setShowAdultModal(true);
                      } else {
                        playChannel(ch);
                      }
                    }}
                  >
                    <div className="mini-guide-channel-logo">
                      {ch.logo ? (
                        <img src={ch.logo} alt="" onError={(e) => e.target.style.display = 'none'} />
                      ) : (
                        <span className="mini-guide-channel-logo-fallback">{ch.name[0]}</span>
                      )}
                    </div>
                    <div className="mini-guide-channel-info">
                      <div className="mini-guide-channel-name">{ch.name}</div>
                      <div className="mini-guide-channel-epg">
                        {ch.epg ? ch.epg.title : 'Sin programación'}
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <div 
                  tabIndex={miniGuideOpen ? "0" : "-1"}
                  className="mini-guide-channel-item"
                  style={{ justifyContent: 'center', color: 'var(--accent)' }}
                  onClick={() => setPage(prev => prev + 1)}
                >
                  <span>{loadingMore ? 'Cargando...' : '➕ Cargar más canales'}</span>
                </div>
              )}
            </div>
          </aside>

          <div className="player-video-container">
            {getYouTubeId(playingChannel.url) ? (
              <iframe
                className="player-video"
                src={`https://www.youtube.com/embed/${getYouTubeId(playingChannel.url)}?autoplay=1&controls=1&rel=0`}
                title={playingChannel.name}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <>
                {loading && <div style={{ color: 'var(--accent)' }}>Cargando streaming...</div>}
                {error && <div style={{ color: 'var(--danger)' }}>⚠ {error}</div>}
                <video ref={videoRef} className="player-video" controls autoPlay />
              </>
            )}
          </div>
        </div>
      )}

      {playingVod && (
        <div 
          className="player-overlay"
          style={{ cursor: playerUiVisible ? 'default' : 'none' }}
          onMouseMove={showPlayerUi}
          onClick={showPlayerUi}
        >
          <div 
            className="player-header"
            style={{ 
              opacity: playerUiVisible ? 1 : 0, 
              pointerEvents: playerUiVisible ? 'auto' : 'none'
            }}
          >
            <div className="player-channel-info">
              <div className="player-logo-fallback">🎬</div>
              <div>
                <div className="player-title">{playingVod.title}</div>
                <div className="player-subtitle">
                  <span>{playingVod.subtitle}</span>
                </div>
              </div>
            </div>
            
            {playingVod.alternatives && playingVod.alternatives.length > 1 && (
              <div className="vod-server-bar">
                <span className="vod-server-label">Servidor:</span>
                {playingVod.alternatives.map((alt, idx) => (
                  <button 
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayingVod(prev => ({
                        ...prev,
                        url: alt.url,
                        currentAlternativeIndex: idx
                      }));
                    }}
                    className={`vod-server-btn ${playingVod.currentAlternativeIndex === idx ? 'active' : ''}`}
                  >
                    {alt.name}
                  </button>
                ))}
              </div>
            )}

            <button 
              onClick={() => { if (hlsRef.current) hlsRef.current.destroy(); setPlayingVod(null); }}
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '8px 20px' }}
            >
              SALIR (Atrás)
            </button>
          </div>

          <div className="player-video-container">
            {playingVod.type === 'iframe' ? (
              <iframe
                className="player-video"
                src={playingVod.url}
                title={playingVod.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <>
                {loading && <div style={{ color: 'var(--accent)' }}>Cargando streaming...</div>}
                {error && <div style={{ color: 'var(--danger)' }}>⚠ {error}</div>}
                <video ref={videoRef} className="player-video" controls autoPlay />
              </>
            )}
          </div>
        </div>
      )}

      <AdultUnlockModal 
        isOpen={showAdultModal} 
        onClose={() => {
          setShowAdultModal(false);
          setPendingChannel(null);
          setPendingGroup(null);
        }}
        onUnlock={handleAdultUnlock}
        API_URL={API_URL}
        token={token}
        theme={theme}
      />

      {showCategoriesModal && (
        <div className="categories-modal-overlay" onClick={() => setShowCategoriesModal(false)}>
          <div className="categories-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="categories-modal-header">
              <h2 className="categories-modal-title">
                🧭 Explorar Categorías
              </h2>
              <button 
                className="categories-modal-close" 
                onClick={() => setShowCategoriesModal(false)}
                tabIndex="0"
              >
                &times;
              </button>
            </div>
            <div className="categories-modal-body">
              <div className="categories-grid">
                {/* Opción Todos */}
                <div 
                  tabIndex="0"
                  className={`category-grid-card ${view === 'all' && !selectedGroup ? 'active' : ''}`}
                  onClick={() => {
                    setView('all');
                    setSelectedGroup(null);
                    setShowCategoriesModal(false);
                  }}
                >
                  <div className="category-grid-icon">📺</div>
                  <div className="category-grid-name">Todos los canales</div>
                  <div className="category-grid-count">{stats?.total || 0} canales</div>
                </div>

                {/* Mapeo de grupos */}
                {groups.map(g => {
                  const isAdultGroup = g.group_title === 'Adultos' || g.group_title === 'XXX' || g.group_title?.toUpperCase().includes('ADULT');
                  
                  // Asignación de icono según el nombre
                  let icon = '📁';
                  const titleLower = g.group_title?.toLowerCase() || '';
                  if (titleLower.includes('cine') || titleLower.includes('película') || titleLower.includes('movie') || titleLower.includes('cinema')) icon = '🎬';
                  else if (titleLower.includes('serie') || titleLower.includes('show')) icon = '🍿';
                  else if (titleLower.includes('deporte') || titleLower.includes('sport') || titleLower.includes('futbol') || titleLower.includes('soccer')) icon = '⚽';
                  else if (titleLower.includes('noticia') || titleLower.includes('news')) icon = '📰';
                  else if (titleLower.includes('infantil') || titleLower.includes('niño') || titleLower.includes('kid')) icon = '👶';
                  else if (titleLower.includes('documental') || titleLower.includes('docu') || titleLower.includes('history')) icon = '📜';
                  else if (titleLower.includes('música') || titleLower.includes('music')) icon = '🎵';
                  else if (titleLower.includes('entretenimiento') || titleLower.includes('varios')) icon = '🎭';
                  else if (isAdultGroup) icon = '🔒';

                  return (
                    <div 
                      key={g.group_title}
                      tabIndex="0"
                      className="category-grid-card"
                      style={g.group_title === 'Adultos' ? { color: 'var(--danger)' } : {}}
                      onClick={() => {
                        if (isAdultGroup && !isAdultUnlocked()) {
                          setPendingGroup(g.group_title);
                          setShowAdultModal(true);
                        } else {
                          setView('group');
                          setSelectedGroup(g.group_title);
                          setShowCategoriesModal(false);
                        }
                      }}
                    >
                      <div className="category-grid-icon">{icon}</div>
                      <div className="category-grid-name">{g.group_title || 'Sin grupo'}</div>
                      <div className="category-grid-count">{g.count} canales</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedVod && (
        <div className="vod-details-overlay" onClick={() => setSelectedVod(null)}>
          <div className="vod-details-card" onClick={(e) => e.stopPropagation()}>
            <button 
              className="vod-details-close" 
              onClick={() => setSelectedVod(null)}
              tabIndex="0"
            >
              &times;
            </button>
            
            <div 
              className="vod-details-backdrop" 
              style={{ backgroundImage: selectedVod.backdrop ? `url(${selectedVod.backdrop})` : 'none' }}
            />
            
            <div className="vod-details-content">
              <div className="vod-details-poster">
                {selectedVod.poster ? (
                  <img src={selectedVod.poster} alt="" />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#090910' }} />
                )}
              </div>
              
              <div className="vod-details-info">
                <h2 className="vod-details-title">{selectedVod.title}</h2>
                
                <div className="vod-details-meta">
                  <span className="vod-details-rating-badge">⭐ {selectedVod.rating ? selectedVod.rating.toFixed(1) : 'N/A'}</span>
                  <span>{selectedVod.year}</span>
                  {selectedVod.genres && selectedVod.genres.length > 0 && (
                    <div className="vod-details-genres" style={{ marginTop: '10px' }}>
                      {selectedVod.genres.map((g, idx) => (
                        <span key={idx} className="vod-details-genre-tag">{g}</span>
                      ))}
                    </div>
                  )}
                </div>
                
                <p className="vod-details-overview">{selectedVod.overview}</p>
                
                {selectedVod.type === 'movie' && (
                  <button 
                    className="vod-play-btn"
                    onClick={() => playVod('movie', selectedVod.id)}
                    tabIndex="0"
                  >
                    ▶ Reproducir Película
                  </button>
                )}
                
                {selectedVod.type === 'tv' && selectedVod.seasons && (
                  <div className="vod-series-container">
                    <div className="vod-series-seasons-bar">
                      {selectedVod.seasons.map(season => (
                        <button
                          key={season.season_number}
                          className={`vod-season-tab ${activeSeason === season.season_number ? 'active' : ''}`}
                          onClick={() => handleSeasonSelect(selectedVod.id, season.season_number)}
                          tabIndex="0"
                        >
                          {season.name}
                        </button>
                      ))}
                    </div>
                    
                    <div className="vod-episodes-list">
                      {loadingVodEpisodes ? (
                        <div style={{ padding: '20px', color: 'var(--accent)' }}>Cargando capítulos...</div>
                      ) : vodEpisodes.length > 0 ? (
                        vodEpisodes.map(ep => (
                          <div 
                            key={ep.id}
                            className="vod-episode-item"
                            onClick={() => playVod('tv', selectedVod.id, activeSeason, ep.episode_number, ep.name)}
                            tabIndex="0"
                          >
                            <div className="vod-episode-still">
                              {ep.still ? (
                                <img src={ep.still} alt="" loading="lazy" />
                              ) : (
                                <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)' }} />
                              )}
                            </div>
                            <div className="vod-episode-info">
                              <div className="vod-episode-name">
                                {ep.episode_number}. {ep.name}
                              </div>
                              <p className="vod-episode-overview">{ep.overview || 'Sin sinopsis disponible.'}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>No hay capítulos disponibles.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
