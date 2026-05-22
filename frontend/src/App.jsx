import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';
import AdminPanel from './AdminPanel';
import AdultUnlockModal from './AdultUnlockModal';
import ProfileSelector from './ProfileSelector';

const API_URL = '/api';

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
      if (showCategoriesModal) {
        if (['Escape', 'Backspace', 'GoBack'].includes(e.key) || e.keyCode === 27 || e.keyCode === 8) {
          e.preventDefault();
          setShowCategoriesModal(false);
          return;
        }
      }

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
        } else if (playingChannel) {
          focusables = Array.from(document.querySelectorAll('.player-overlay [tabindex="0"], .player-overlay button'));
        } else {
          focusables = Array.from(document.querySelectorAll('[tabindex="0"], button, input, select')).filter(el => {
            return !el.closest('.categories-modal-overlay') && !el.closest('.player-overlay');
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
  }, [channels, groups, view, playingChannel, profile, adultToken, adultUnlockedUntil, showCategoriesModal]);

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
            placeholder="Buscar canal..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
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
      </aside>

      <main className="app-main">
        {view === 'admin' ? (
          <AdminPanel token={token} API_URL={API_URL} theme={theme} styles={styles} />
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
              <img src={playingChannel.logo} className="player-logo" alt="" />
              <div>
                <div className="player-title">{playingChannel.name}</div>
                <div className="player-subtitle">
                  <span>EN VIVO • {playingChannel.group_title}</span>
                  <span className="player-zap-hint">(Usa flechas ▼▲ para zapping)</span>
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
          <div className="player-video-container">
            {loading && <div style={{ color: 'var(--accent)' }}>Cargando streaming...</div>}
            {error && <div style={{ color: 'var(--danger)' }}>⚠ {error}</div>}
            <video ref={videoRef} className="player-video" controls autoPlay />
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

    </div>
  );
}

export default App;
