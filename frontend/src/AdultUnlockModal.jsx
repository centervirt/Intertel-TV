import React, { useState } from 'react';
import axios from 'axios';

function AdultUnlockModal({ isOpen, onClose, onUnlock, API_URL, token, theme }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/adult/unlock`, { pin }, {
        headers: { 'x-auth-token': token }
      });
      
      if (res.data.success) {
        onUnlock(res.data.adultToken, res.data.expiresIn);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al desbloquear');
    } finally {
      setLoading(true);
      setTimeout(() => setLoading(false), 500);
    }
  };

  const modalStyles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      animation: 'fadeIn 0.3s ease',
    },
    card: {
      backgroundColor: theme.surface,
      padding: '40px',
      borderRadius: '24px',
      border: `1px solid rgba(211, 47, 47, 0.3)`,
      width: '100%',
      maxWidth: '400px',
      textAlign: 'center',
      boxShadow: '0 0 50px rgba(211, 47, 47, 0.15)',
    },
    icon: {
      fontSize: '48px',
      marginBottom: '20px',
      color: '#d32f2f',
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      marginBottom: '10px',
      color: theme.text,
    },
    subtitle: {
      fontSize: '14px',
      color: theme.text2,
      marginBottom: '30px',
    },
    input: {
      width: '100%',
      padding: '16px',
      borderRadius: '12px',
      border: `1px solid ${theme.border}`,
      backgroundColor: 'rgba(255,255,255,0.03)',
      color: '#fff',
      fontSize: '24px',
      textAlign: 'center',
      letterSpacing: '10px',
      marginBottom: '20px',
      outline: 'none',
      transition: 'border-color 0.2s',
    },
    button: {
      width: '100%',
      padding: '16px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: '#d32f2f',
      color: '#fff',
      fontSize: '16px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'transform 0.2s, background-color 0.2s',
    },
    cancel: {
      marginTop: '15px',
      background: 'none',
      border: 'none',
      color: theme.text3,
      cursor: 'pointer',
      fontSize: '14px',
    },
    error: {
      color: '#ff4f4f',
      fontSize: '13px',
      marginTop: '10px',
      marginBottom: '10px',
    }
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <div style={modalStyles.icon}>🔒</div>
        <div style={modalStyles.title}>Contenido Protegido</div>
        <div style={modalStyles.subtitle}>Ingrese su PIN parental para acceder</div>
        
        <form onSubmit={handleSubmit}>
          <input 
            type="password"
            maxLength="4"
            pattern="\d*"
            inputMode="numeric"
            autoFocus
            style={modalStyles.input}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="****"
            required
          />
          {error && <div style={modalStyles.error}>{error}</div>}
          <button 
            type="submit" 
            style={{ 
              ...modalStyles.button, 
              opacity: loading ? 0.7 : 1,
              transform: loading ? 'scale(0.98)' : 'scale(1)'
            }}
            disabled={loading}
          >
            {loading ? 'VALIDANDO...' : 'DESBLOQUEAR'}
          </button>
        </form>
        
        <button style={modalStyles.cancel} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

export default AdultUnlockModal;
