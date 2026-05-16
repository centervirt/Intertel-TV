import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AVATARS = {
  home: '🏠',
  kids: '👶',
  adult: '🧔',
};

const TYPE_LABELS = {
  home: 'Principal',
  kids: 'Niños',
  adult: 'Adulto',
};

const TYPE_COLORS = {
  home: '#1e88e5',
  kids: '#4caf50',
  adult: '#d32f2f',
};

function ProfileSelector({ token, API_URL, onProfileSelect }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', type: 'home', pin: '', confirmPin: '' });
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/profiles`, {
        headers: { 'x-auth-token': token }
      });
      setProfiles(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (profile) => {
    if (profile.pin_hash || profile.has_pin) {
      setSelectedProfile(profile);
      setPin('');
      setPinError('');
    } else {
      submitSelection(profile.id);
    }
  };

  const submitSelection = async (profileId, pinCode = null) => {
    setSelecting(true);
    setGeneralError('');
    try {
      const res = await axios.post(`${API_URL}/profiles/select`,
        { profileId, pin: pinCode },
        { headers: { 'x-auth-token': token } }
      );
      onProfileSelect(res.data.profile, res.data.profileToken);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al seleccionar perfil';
      if (selectedProfile) {
        setPinError(msg);
      } else {
        setGeneralError(msg);
      }
    } finally {
      setSelecting(false);
    }
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!newProfile.name.trim()) { setCreateError('El nombre es obligatorio'); return; }
    if (newProfile.pin && newProfile.pin !== newProfile.confirmPin) {
      setCreateError('Los PINs no coinciden');
      return;
    }
    if (newProfile.pin && newProfile.pin.length !== 4) {
      setCreateError('El PIN debe tener exactamente 4 dígitos');
      return;
    }
    setCreating(true);
    try {
      const accessLevel = newProfile.type === 'kids' ? 0 : newProfile.type === 'adult' ? 3 : 2;
      await axios.post(`${API_URL}/profiles`,
        {
          name: newProfile.name,
          type: newProfile.type,
          pin: newProfile.pin || null,
          access_level: accessLevel
        },
        { headers: { 'x-auth-token': token } }
      );
      setShowCreateModal(false);
      setNewProfile({ name: '', type: 'home', pin: '', confirmPin: '' });
      fetchProfiles();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Error al crear perfil');
    } finally {
      setCreating(false);
    }
  };

  const styles = {
    overlay: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#141414',
      color: '#fff',
      fontFamily: "'Outfit', 'DM Sans', sans-serif",
      padding: '40px 20px',
    },
    title: {
      fontSize: '36px',
      fontWeight: '700',
      marginBottom: '10px',
      color: '#fff',
    },
    subtitle: {
      fontSize: '15px',
      color: '#888',
      marginBottom: '50px',
    },
    grid: {
      display: 'flex',
      gap: '28px',
      flexWrap: 'wrap',
      justifyContent: 'center',
      maxWidth: '900px',
    },
    card: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px',
      cursor: 'pointer',
      transition: 'transform 0.2s ease',
      width: '150px',
    },
    avatar: (type) => ({
      width: '130px',
      height: '130px',
      borderRadius: '12px',
      backgroundColor: TYPE_COLORS[type] || '#333',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '55px',
      border: '3px solid transparent',
      transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
    }),
    addAvatar: {
      width: '130px',
      height: '130px',
      borderRadius: '12px',
      backgroundColor: 'transparent',
      border: '2px dashed #444',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '40px',
      color: '#555',
      transition: 'border-color 0.2s, color 0.2s',
    },
    name: {
      fontSize: '15px',
      color: '#aaa',
      fontWeight: '500',
      textAlign: 'center',
    },
    badge: (type) => ({
      fontSize: '10px',
      padding: '2px 8px',
      borderRadius: '20px',
      backgroundColor: TYPE_COLORS[type] + '33',
      color: TYPE_COLORS[type],
      fontWeight: '600',
      textTransform: 'uppercase',
    }),
    pinModal: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.92)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
    },
    pinBox: {
      backgroundColor: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '40px',
      minWidth: '300px',
      textAlign: 'center',
    },
    pinInput: {
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '2px solid #fff',
      color: '#fff',
      fontSize: '32px',
      textAlign: 'center',
      width: '180px',
      letterSpacing: '12px',
      outline: 'none',
      margin: '20px 0',
    },
    createModal: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.88)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
    },
    createBox: {
      backgroundColor: '#1c1c1c',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '36px',
      width: '400px',
      color: '#fff',
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      backgroundColor: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '15px',
      outline: 'none',
      boxSizing: 'border-box',
      marginBottom: '14px',
    },
    select: {
      width: '100%',
      padding: '12px 14px',
      backgroundColor: '#2a2a2a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '15px',
      outline: 'none',
      marginBottom: '14px',
    },
    btn: (color = '#4fc3f7') => ({
      width: '100%',
      padding: '13px',
      backgroundColor: color,
      color: '#000',
      border: 'none',
      borderRadius: '8px',
      fontWeight: '700',
      fontSize: '14px',
      cursor: 'pointer',
      marginBottom: '10px',
    }),
    btnSecondary: {
      width: '100%',
      padding: '11px',
      backgroundColor: 'transparent',
      color: '#888',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
    },
    typeGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '10px',
      marginBottom: '16px',
    },
    typeBtn: (selected, type) => ({
      padding: '10px 6px',
      borderRadius: '8px',
      border: `2px solid ${selected ? TYPE_COLORS[type] : 'rgba(255,255,255,0.08)'}`,
      backgroundColor: selected ? TYPE_COLORS[type] + '22' : 'transparent',
      color: selected ? TYPE_COLORS[type] : '#888',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      textAlign: 'center',
      transition: 'all 0.15s',
    }),
  };

  if (loading) {
    return (
      <div style={styles.overlay}>
        <div style={{ fontSize: '20px', color: '#555' }}>Cargando perfiles...</div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <h1 style={styles.title}>¿Quién está viendo?</h1>
      <p style={styles.subtitle}>Selecciona tu perfil para continuar</p>

      {generalError && (
        <div style={{
          backgroundColor: 'rgba(255,79,79,0.12)',
          border: '1px solid rgba(255,79,79,0.3)',
          borderRadius: '8px',
          padding: '12px 20px',
          marginBottom: '24px',
          color: '#ff6b6b',
          fontSize: '14px',
          maxWidth: '500px',
          textAlign: 'center',
        }}>
          ⚠️ {generalError}
        </div>
      )}

      {selecting && (
        <div style={{ color: '#4fc3f7', marginBottom: '20px', fontSize: '14px' }}>
          Cargando perfil...
        </div>
      )}

      <div style={styles.grid}>
        {profiles.map(p => (
          <div
            key={p.id}
            style={styles.card}
            onClick={() => handleSelect(p)}
            onMouseEnter={e => {
              e.currentTarget.querySelector('.av').style.borderColor = '#fff';
              e.currentTarget.querySelector('.av').style.boxShadow = `0 0 0 4px ${TYPE_COLORS[p.type]}44`;
              e.currentTarget.querySelector('.nm').style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.querySelector('.av').style.borderColor = 'transparent';
              e.currentTarget.querySelector('.av').style.boxShadow = 'none';
              e.currentTarget.querySelector('.nm').style.color = '#aaa';
            }}
          >
            <div className="av" style={styles.avatar(p.type)}>{AVATARS[p.type] || '👤'}</div>
            <div className="nm" style={styles.name}>{p.name}</div>
            <div style={styles.badge(p.type)}>{TYPE_LABELS[p.type]}</div>
          </div>
        ))}

        {/* Add Profile Button */}
        <div
          style={styles.card}
          onClick={() => setShowCreateModal(true)}
          onMouseEnter={e => {
            e.currentTarget.querySelector('.add-av').style.borderColor = '#4fc3f7';
            e.currentTarget.querySelector('.add-av').style.color = '#4fc3f7';
            e.currentTarget.querySelector('.add-nm').style.color = '#4fc3f7';
          }}
          onMouseLeave={e => {
            e.currentTarget.querySelector('.add-av').style.borderColor = '#444';
            e.currentTarget.querySelector('.add-av').style.color = '#555';
            e.currentTarget.querySelector('.add-nm').style.color = '#666';
          }}
        >
          <div className="add-av" style={styles.addAvatar}>＋</div>
          <div className="add-nm" style={{ ...styles.name, color: '#666' }}>Añadir Perfil</div>
        </div>
      </div>

      {/* PIN Modal */}
      {selectedProfile && (
        <div style={styles.pinModal}>
          <div style={styles.pinBox}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>{AVATARS[selectedProfile.type]}</div>
            <h3 style={{ margin: '0 0 6px', fontSize: '20px' }}>{selectedProfile.name}</h3>
            <p style={{ color: '#777', margin: '0 0 20px', fontSize: '14px' }}>Ingresa tu PIN de 4 dígitos</p>
            
            {/* PIN dots display */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid #555',
                  backgroundColor: pin.length > i ? '#4fc3f7' : 'transparent',
                  transition: 'background-color 0.15s'
                }} />
              ))}
            </div>

            {/* Hidden input for keyboard input */}
            <input
              type="password"
              maxLength="4"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
              value={pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setPin(val);
                setPinError('');
                if (val.length === 4) submitSelection(selectedProfile.id, val);
              }}
              id="pin-hidden-input"
            />

            {/* Numeric keypad */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', maxWidth: '220px', margin: '0 auto 16px' }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((key, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={key === ''}
                  style={{
                    padding: '14px',
                    fontSize: key === '⌫' ? '20px' : '22px',
                    fontWeight: '500',
                    backgroundColor: key === '' ? 'transparent' : 'rgba(255,255,255,0.06)',
                    border: key === '' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: key === '⌫' ? '#ff6b6b' : '#fff',
                    cursor: key === '' ? 'default' : 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => { if (key !== '') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { if (key !== '') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                  onClick={() => {
                    if (key === '') return;
                    if (key === '⌫') {
                      setPin(prev => prev.slice(0, -1));
                      setPinError('');
                      return;
                    }
                    const newPin = pin + String(key);
                    if (newPin.length <= 4) {
                      setPin(newPin);
                      setPinError('');
                      if (newPin.length === 4) submitSelection(selectedProfile.id, newPin);
                    }
                  }}
                >
                  {key}
                </button>
              ))}
            </div>

            {pinError && (
              <div style={{ color: '#ff4f4f', marginBottom: '12px', fontSize: '13px', fontWeight: '600' }}>
                ❌ {pinError}
              </div>
            )}

            <button
              style={{ ...styles.btnSecondary, marginTop: '4px' }}
              onClick={() => { setSelectedProfile(null); setPin(''); setPinError(''); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div style={styles.createModal}>
          <div style={styles.createBox}>
            <h3 style={{ margin: '0 0 6px', fontSize: '20px' }}>Crear nuevo perfil</h3>
            <p style={{ color: '#666', margin: '0 0 24px', fontSize: '13px' }}>
              Personaliza el acceso a este perfil
            </p>

            <form onSubmit={handleCreateProfile}>
              <label style={{ fontSize: '12px', color: '#888', marginBottom: '6px', display: 'block' }}>NOMBRE</label>
              <input
                style={styles.input}
                placeholder="Ej: Papá, Mamá, Kids..."
                value={newProfile.name}
                onChange={e => setNewProfile({ ...newProfile, name: e.target.value })}
                autoFocus
                required
              />

              <label style={{ fontSize: '12px', color: '#888', marginBottom: '8px', display: 'block' }}>TIPO DE PERFIL</label>
              <div style={styles.typeGrid}>
                {Object.entries(TYPE_LABELS).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    style={styles.typeBtn(newProfile.type === type, type)}
                    onClick={() => setNewProfile({ ...newProfile, type })}
                  >
                    {AVATARS[type]} {label}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: '12px', color: '#888', marginBottom: '6px', display: 'block' }}>
                PIN (Opcional — 4 dígitos)
              </label>
              <input
                style={styles.input}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                placeholder="Dejar vacío si no quiere PIN"
                value={newProfile.pin}
                onChange={e => setNewProfile({ ...newProfile, pin: e.target.value.replace(/\D/g, '') })}
              />

              {newProfile.pin && (
                <input
                  style={styles.input}
                  type="password"
                  inputMode="numeric"
                  maxLength="4"
                  placeholder="Confirmar PIN"
                  value={newProfile.confirmPin}
                  onChange={e => setNewProfile({ ...newProfile, confirmPin: e.target.value.replace(/\D/g, '') })}
                />
              )}

              {createError && (
                <div style={{ color: '#ff4f4f', fontSize: '13px', marginBottom: '14px' }}>{createError}</div>
              )}

              <button type="submit" style={styles.btn()} disabled={creating}>
                {creating ? 'Creando...' : 'CREAR PERFIL'}
              </button>
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => { setShowCreateModal(false); setCreateError(''); setNewProfile({ name: '', type: 'home', pin: '', confirmPin: '' }); }}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileSelector;
