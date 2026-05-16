import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';
import AdminPanel from './AdminPanel';
import AdultUnlockModal from './AdultUnlockModal';
import ProfileSelector from './ProfileSelector';

const API_URL = 'http://localhost:3001/api';

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
  app: {
    backgroundColor: theme.bg,
    color: theme.text,
    fontFamily: "'DM Sans', sans-serif",
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  loginContainer: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.gradient,
  },
  loginCard: {
    backgroundColor: theme.surface,
    padding: '40px',
    borderRadius: '16px',
    border: `1px solid ${theme.border}`,
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    textAlign: 'center',
  },
  logo: {
    fontSize: '28px',
    fontWeight: '800',
    marginBottom: '30px',
    letterSpacing: '-0.5px',
  },
  logoAcento: {
    color: theme.accent,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    marginBottom: '16px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    color: theme.text,
    outline: 'none',
    fontSize: '15px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: theme.accent,
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '15px',
    transition: 'opacity 0.2s',
  },
  header: {
    height: '56px',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    borderBottom: `1px solid ${theme.border}`,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  sidebar: {
    width: '230px',
    backgroundColor: theme.surface,
    borderRight: `1px solid ${theme.border}`,
    position: 'fixed',
    top: '56px',
    bottom: 0,
    left: 0,
    overflowY: 'auto',
    padding: '20px 0',
  },
  main: {
    marginLeft: '230px',
    marginTop: '56px',
    padding: '30px',
    flex: 1,
  },
  channelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
  },
  channelCard: {
    backgroundColor: theme.surface,
    borderRadius: '12px',
    padding: '16px',
    border: `1px solid ${theme.border}`,
    transition: 'transform 0.2s, background-color 0.2s',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  channelLogo: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    marginBottom: '12px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    objectFit: 'contain',
  },
  channelName: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '4px',
    color: theme.text,
  },
  channelGroup: {
    fontSize: '11px',
    color: theme.text3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  favBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'none',
    border: 'none',
    color: theme.text3,
    cursor: 'pointer',
    fontSize: '18px',
  },
  activeFav: {
    color: theme.accent,
  },
  playerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
  },
  playerHeader: {
    height: '60px',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1001,
  },
  videoContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    maxHeight: '100%',
    aspectRatio: '16/9',
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
  const playerUiTimerRef = useRef(null);

  const showPlayerUi = () => {
    setPlayerUiVisible(true);
    if (playerUiTimerRef.current) clearTimeout(playerUiTimerRef.current);
    playerUiTimerRef.current = setTimeout(() => {
      setPlayerUiVisible(false);
    }, 3500);
  };

  useEffect(() => {
    if (playingChannel) {
      showPlayerUi();
    } else {
      if (playerUiTimerRef.current) clearTimeout(playerUiTimerRef.current);
    }
  }, [playingChannel]);

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
    }
  };

  useEffect(() => {
    // Spatial Navigation & Player Controls for Android TV
    const handleKeyDown = (e) => {
      if (playingChannel) {
        showPlayerUi();
        
        if (['Escape', 'Backspace', 'GoBack'].includes(e.key) || e.keyCode === 27 || e.keyCode === 8) {
          e.preventDefault();
          if (hlsRef.current) hlsRef.current.destroy();
          setPlayingChannel(null);
          return;
        }

        if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
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
        return; // Ignore other keys while playing
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
        const focusables = Array.from(document.querySelectorAll('[tabindex="0"], button, input, select'));
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
  }, [channels, groups, view, playingChannel, profile, adultToken, adultUnlockedUntil]);

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
      setPage(1);
      fetchData(false);
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
    const config = { headers: { 'x-auth-token': token } };
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
    if (playingChannel && videoRef.current) {
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
  }, [playingChannel]);

  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <form style={styles.loginCard} onSubmit={handleLogin}>
          <div style={styles.logo}>
            {settings.isp_logo && <img src={settings.isp_logo} style={{ height: '40px', marginBottom: '10px' }} />}
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
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={{ ...styles.logo, marginBottom: 0, display: 'flex', alignItems: 'center' }}>
          {settings.isp_logo && <img src={settings.isp_logo} style={{ height: '30px', marginRight: '10px' }} />}
          {settings.isp_name}
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '15px', padding: '4px 12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '20px' }}>
            <span style={{ fontSize: '18px' }}>{profile?.type === 'kids' || profile?.access_level <= 1 ? '👶' : '🧔'}</span>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>{profile?.name}</span>
            <button 
              onClick={() => {
                setProfile(null);
                setProfileToken(null);
                localStorage.removeItem('profile');
                localStorage.removeItem('profileToken');
              }}
              style={{ background: 'none', border: 'none', color: theme.accent, fontSize: '11px', cursor: 'pointer', marginLeft: '5px' }}
            >
              (CAMBIAR)
            </button>
          </div>
          <div style={{ fontSize: '13px', color: theme.text2 }}>
            <span style={{ color: theme.accent }}>{stats?.total || 0}</span> Canales | 
            <span style={{ color: theme.accent }}> {stats?.groups || 0}</span> Categorías
          </div>
          {user.is_admin === 1 && (
            <button 
              onClick={() => setView('admin')}
              style={{ ...styles.button, width: 'auto', padding: '6px 16px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              ADMIN
            </button>
          )}
          <button 
            onClick={handleLogout}
            style={{ ...styles.button, width: 'auto', padding: '6px 16px', backgroundColor: 'rgba(255,79,79,0.2)', color: '#ff4f4f' }}
          >
            SALIR
          </button>
        </div>
      </header>

      <aside style={styles.sidebar}>
        <div style={{ padding: '0 20px 20px' }}>
          <input 
            style={{ ...styles.input, marginBottom: 0 }} 
            placeholder="Buscar canal..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
          />
        </div>
        
        <div 
          onClick={() => { setView('all'); setSelectedGroup(null); }}
          style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: view === 'all' ? 'rgba(255,255,255,0.05)' : 'transparent' }}
        >
          Todos los canales
        </div>
        <div 
          tabIndex="0"
          onClick={() => setView('favorites')}
          style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: view === 'favorites' ? 'rgba(255,255,255,0.05)' : 'transparent', display: 'flex', justifyContent: 'space-between', outline: 'none' }}
        >
          Favoritos <span>★ {favorites.length}</span>
        </div>

        <div style={{ padding: '20px 20px 10px', fontSize: '12px', color: theme.text3, fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          GRUPOS
          <div 
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
            style={{ fontSize: '10px', cursor: 'pointer', color: familyMode ? theme.accent : theme.text3, border: `1px solid ${familyMode ? theme.accent : theme.text3}`, padding: '2px 6px', borderRadius: '4px' }}
          >
            {familyMode ? 'MODO FAMILIAR ON' : 'MODO FAMILIAR OFF'}
          </div>
        </div>
        {groups.map(g => (
          <div 
            key={g.group_title}
            tabIndex="0"
            onClick={() => { 
              const isAdultGroup = g.group_title === 'Adultos' || g.group_title === 'XXX' || g.group_title?.toUpperCase().includes('ADULT');
              if (isAdultGroup && !isAdultUnlocked()) {
                setShowAdultModal(true);
              } else {
                setView('group'); 
                setSelectedGroup(g.group_title); 
              }
            }}
            style={{ 
              padding: '8px 20px', 
              cursor: 'pointer', 
              fontSize: '14px',
              backgroundColor: selectedGroup === g.group_title ? 'rgba(255,255,255,0.05)' : 'transparent',
              display: 'flex',
              justifyContent: 'space-between',
              color: g.group_title === 'Adultos' ? '#ff4f4f' : theme.text,
              fontWeight: g.group_title === 'Adultos' ? '700' : '400',
              outline: 'none'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.group_title === 'Adultos' ? '🔒 ' : ''}{g.group_title || 'Sin grupo'}
            </span>
            <span style={{ color: theme.text3, fontSize: '12px' }}>{g.count}</span>
          </div>
        ))}
      </aside>

      <main style={styles.main}>
        {view === 'admin' ? (
          <AdminPanel token={token} API_URL={API_URL} theme={theme} styles={styles} />
        ) : (
          <>
            <h2 style={{ marginBottom: '24px', fontSize: '22px' }}>
              {view === 'favorites' ? 'Mis Favoritos' : selectedGroup || 'Todos los canales'}
              <span style={{ color: theme.text3, fontSize: '14px', marginLeft: '12px' }}>{channels.length} canales</span>
            </h2>
            <div style={styles.channelGrid}>
              {channels.map(ch => (
                <div 
                  key={`${ch.id}-${ch.name}`} 
                  tabIndex="0"
                  className="channel-card"
                  style={{ ...styles.channelCard, opacity: ch.status === 'maintenance' ? 0.4 : (ch.status === 'unstable' ? 0.7 : (ch.status === 'warning' ? 0.85 : 1)), outline: 'none' }} 
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
                    style={{ ...styles.favBtn, ...(favorites.some(f => f.id === ch.id) ? styles.activeFav : {}) }}
                    onClick={(e) => toggleFavorite(e, ch.id)}
                  >
                    ★
                  </button>
                  {ch.logo ? (
                    <img src={ch.logo} style={styles.channelLogo} alt={ch.name} loading="lazy" onError={(e) => e.target.style.display = 'none'} />
                  ) : (
                    <div style={styles.channelLogo}>{ch.name[0]}</div>
                  )}
                  <div style={styles.channelName}>
                    {ch.is_adult === 1 && <span style={{ color: '#ff4f4f', marginRight: '6px', fontSize: '10px', border: '1px solid #ff4f4f', padding: '1px 3px', borderRadius: '4px' }}>+18</span>}
                    {ch.status === 'maintenance' && <span title="Mantenimiento" style={{ color: '#ff4f4f', marginRight: '6px' }}>●</span>}
                    {ch.status === 'unstable' && <span title="Inestable" style={{ color: '#ffc107', marginRight: '6px' }}>●</span>}
                    {ch.status === 'warning' && <span title="Intermitente" style={{ color: '#ff9800', marginRight: '6px' }}>●</span>}
                    {ch.name}
                  </div>
                  <div style={{ ...styles.channelGroup, color: (ch.status === 'maintenance' || ch.is_online === 0) ? '#ff4f4f' : (ch.status === 'unstable' ? '#ffc107' : theme.text3) }}>
                    {ch.status === 'maintenance' ? 'TEMPORALMENTE NO DISPONIBLE' : (ch.status === 'unstable' ? 'CONEXIÓN INESTABLE' : (ch.is_online === 0 ? 'FUERA DE LÍNEA' : ch.group_title))}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div ref={loaderRef} style={{ padding: '40px', textAlign: 'center', color: theme.accent }}>
                {loadingMore ? 'Cargando más canales...' : 'Desliza para ver más'}
              </div>
            )}
          </>
        )}
      </main>

      {playingChannel && (
        <div 
          style={{ ...styles.playerOverlay, cursor: playerUiVisible ? 'default' : 'none' }}
          onMouseMove={showPlayerUi}
          onClick={showPlayerUi}
        >
          <div style={{ 
            ...styles.playerHeader, 
            opacity: playerUiVisible ? 1 : 0, 
            transition: 'opacity 0.3s',
            pointerEvents: playerUiVisible ? 'auto' : 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img src={playingChannel.logo} style={{ width: '32px', height: '32px', borderRadius: '4px' }} alt="" />
              <div>
                <div style={{ fontWeight: '700' }}>{playingChannel.name}</div>
                <div style={{ fontSize: '12px', color: theme.accent }}>
                  EN VIVO • {playingChannel.group_title} 
                  <span style={{ marginLeft: '10px', color: theme.text2 }}>(Usa flechas ▼▲ para zapping)</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => { if (hlsRef.current) hlsRef.current.destroy(); setPlayingChannel(null); }}
              style={{ ...styles.button, width: 'auto', padding: '8px 20px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              SALIR (Atrás)
            </button>
          </div>
          <div style={styles.videoContainer}>
            {loading && <div style={{ color: theme.accent }}>Cargando streaming...</div>}
            {error && <div style={{ color: '#ff4f4f' }}>⚠ {error}</div>}
            <video ref={videoRef} style={styles.video} controls autoPlay />
          </div>
        </div>
      )}

      <AdultUnlockModal 
        isOpen={showAdultModal} 
        onClose={() => setShowAdultModal(false)}
        onUnlock={handleAdultUnlock}
        API_URL={API_URL}
        token={token}
        theme={theme}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background-color: ${theme.bg}; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
      `}} />
    </div>
  );
}

export default App;
