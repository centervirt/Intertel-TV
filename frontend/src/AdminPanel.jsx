import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AdminDashboard from './AdminDashboard';

function AdminPanel({ token, API_URL, theme, styles }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [branding, setBranding] = useState({ isp_name: '', isp_logo: '' });
  const [adultSettings, setAdultSettings] = useState({ enabled: true, timeout: 30, pin: '' });
  const [adultChannels, setAdultChannels] = useState([]);
  const [adultGroups, setAdultGroups] = useState([]);
  const [adultSearch, setAdultSearch] = useState('');
  const [adultGroupFilter, setAdultGroupFilter] = useState('');
  const [showAdultOnly, setShowAdultOnly] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [apks, setApks] = useState([]);
  const [apkUploadProgress, setApkUploadProgress] = useState(0);
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }

  // Helper: show custom confirm dialog
  const showConfirm = (message, onConfirm) => setConfirmModal({ message, onConfirm });

  const config = { headers: { 'x-auth-token': token } };

  useEffect(() => {
    fetchAdminData();
    if (tab === 'branding') {
      fetchBranding();
    }
    if (tab === 'adult') {
      fetchAdultSettings();
      fetchAdultChannels();
    }
    if (tab === 'audit') {
      fetchAuditLogs();
    }
    if (tab === 'apks') {
      fetchApks();
    }
  }, [tab]);

  const fetchAdminData = async () => {
    try {
      const statsRes = await axios.get(`${API_URL}/admin/stats`, config);
      setStats(statsRes.data);

      if (tab === 'users') {
        const usersRes = await axios.get(`${API_URL}/admin/users`, config);
        setUsers(usersRes.data);
      }
      if (tab === 'sources') {
        const sourcesRes = await axios.get(`${API_URL}/admin/sources`, config);
        setSources(sourcesRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBranding = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`);
      setBranding(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const saveBranding = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/admin/settings`, branding, config);
      alert('Branding actualizado');
    } catch (err) {
      alert('Error al guardar');
    }
  };

  const fetchAdultSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/settings/adult`, config);
      setAdultSettings({ ...res.data, pin: '' });
    } catch (err) { console.error(err); }
  };

  const fetchAdultChannels = async (search = adultSearch, group = adultGroupFilter, adultOnly = showAdultOnly) => {
    try {
      let url = `${API_URL}/admin/channels?search=${encodeURIComponent(search)}&group=${encodeURIComponent(group)}`;
      if (adultOnly) url += '&adult_only=1';
      const res = await axios.get(url, config);
      setAdultChannels(res.data.channels);
      setAdultGroups(res.data.groups);
    } catch (err) { console.error(err); }
  };

  const saveAdultSettings = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/admin/settings/adult`, adultSettings, config);
      alert('Configuración de adultos actualizada');
    } catch (err) { alert('Error al guardar'); }
  };

  const toggleChannelAdult = async (channelId, isAdult) => {
    try {
      // We need an endpoint for this or use existing channel update
      await axios.put(`${API_URL}/admin/channels/${channelId}`, { is_adult: isAdult ? 0 : 1 }, config);
      fetchAdultChannels();
    } catch (err) { alert('Error al actualizar canal'); }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/audit`, config);
      setAuditLogs(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchApks = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/apks`, config);
      setApks(res.data);
    } catch (err) { console.error(err); }
  };

  const uploadApk = async (e) => {
    e.preventDefault();
    const file = e.target.apkFile.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('apk', file);

    try {
      setApkUploadProgress(1); // start
      await axios.post(`${API_URL}/admin/apks`, formData, {
        headers: { ...config.headers, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setApkUploadProgress(percentCompleted);
        }
      });
      setApkUploadProgress(0);
      e.target.reset();
      fetchApks();
      alert('Archivo subido correctamente');
    } catch (err) {
      setApkUploadProgress(0);
      alert('Error al subir el archivo');
    }
  };

  const deleteApk = async (filename) => {
    showConfirm(`¿Eliminar el archivo "${filename}"?`, async () => {
      try {
        await axios.delete(`${API_URL}/admin/apks/${filename}`, config);
        fetchApks();
      } catch (err) {
        alert('Error al eliminar');
      }
    });
  };

  const handleRefresh = async () => {
    try {
      await axios.post(`${API_URL}/admin/refresh`, {}, config);
      alert('Actualización iniciada');
      fetchAdminData();
    } catch (err) {
      alert('Ya hay una actualización en curso');
    }
  };

  const deleteUser = async (id, username) => {
    showConfirm(`¿Eliminar usuario "${username}"?`, async () => {
      try {
        await axios.delete(`${API_URL}/admin/users/${id}`, config);
        const usersRes = await axios.get(`${API_URL}/admin/users`, config);
        setUsers(usersRes.data);
      } catch (err) {
        alert(err.response?.data?.error || 'Error');
      }
    });
  };

  const deleteSource = async (id, name) => {
    showConfirm(
      `¿Eliminar la fuente "${name}"?`,
      async () => {
        try {
          await axios.delete(`${API_URL}/admin/sources/${id}`, config);
          const sourcesRes = await axios.get(`${API_URL}/admin/sources`, config);
          setSources(sourcesRes.data);
        } catch (err) {
          alert(err.response?.data?.error || 'Error al eliminar la fuente');
        }
      }
    );
  };

  const adminStyles = {
    card: {
      backgroundColor: 'rgba(255,255,255,0.02)',
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '20px',
    },
    tabBtn: (active) => ({
      padding: '8px 20px',
      marginRight: '10px',
      borderRadius: '8px',
      border: `1px solid ${active ? theme.accent : theme.border}`,
      backgroundColor: active ? 'rgba(79,195,247,0.1)' : 'transparent',
      color: active ? theme.accent : theme.text2,
      cursor: 'pointer',
      fontWeight: '600',
    }),
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '20px',
    },
    th: {
      textAlign: 'left',
      padding: '12px',
      borderBottom: `1px solid ${theme.border}`,
      color: theme.text3,
      fontSize: '12px',
      textTransform: 'uppercase',
    },
    td: {
      padding: '12px',
      borderBottom: `1px solid ${theme.border}`,
      fontSize: '14px',
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Panel de Administración</h2>
          <div style={{ color: theme.text3, fontSize: '14px' }}>Gestiona usuarios, fuentes y canales.</div>
        </div>
        <button onClick={handleRefresh} style={{ ...styles.button, width: 'auto', padding: '10px 24px' }}>
          ACTUALIZAR CANALES AHORA
        </button>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <button style={adminStyles.tabBtn(tab === 'dashboard')} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button style={adminStyles.tabBtn(tab === 'users')} onClick={() => setTab('users')}>Usuarios</button>
        <button style={adminStyles.tabBtn(tab === 'sources')} onClick={() => setTab('sources')}>Fuentes M3U</button>
        <button style={adminStyles.tabBtn(tab === 'apks')} onClick={() => setTab('apks')}>App APK</button>
        <button style={adminStyles.tabBtn(tab === 'branding')} onClick={() => setTab('branding')}>Branding</button>
        <button style={adminStyles.tabBtn(tab === 'adult')} onClick={() => setTab('adult')}>Adultos (+18)</button>
        <button style={adminStyles.tabBtn(tab === 'audit')} onClick={() => setTab('audit')}>Auditoría</button>
      </div>

      {tab === 'audit' && (
        <div style={adminStyles.card}>
          <h3>Logs de Auditoría</h3>
          <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={adminStyles.table}>
              <thead>
                <tr>
                  <th style={adminStyles.th}>Fecha</th>
                  <th style={adminStyles.th}>Usuario</th>
                  <th style={adminStyles.th}>Perfil</th>
                  <th style={adminStyles.th}>Evento</th>
                  <th style={adminStyles.th}>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={adminStyles.td}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={adminStyles.td}>{log.username}</td>
                    <td style={adminStyles.td}>{log.profile_name || '-'}</td>
                    <td style={adminStyles.td}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px',
                        backgroundColor: log.event.includes('fail') ? 'rgba(255,79,79,0.1)' : 'rgba(79,195,247,0.1)',
                        color: log.event.includes('fail') ? '#ff4f4f' : theme.accent
                      }}>
                        {log.event.toUpperCase()}
                      </span>
                    </td>
                    <td style={adminStyles.td}>
                      {(() => {
                        try {
                          const meta = JSON.parse(log.metadata);
                          return `IP: ${meta.ip}`;
                        } catch(e) { return '-'; }
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'apks' && (
        <div>
          <div style={adminStyles.card}>
            <h3>📤 Subir Nuevo Archivo</h3>
            <form onSubmit={uploadApk} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '500px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: theme.text3, marginBottom: '8px' }}>SELECCIONAR ARCHIVO (.APK)</label>
                <input 
                  type="file" 
                  name="apkFile" 
                  accept=".apk"
                  style={{ ...styles.input, padding: '10px' }} 
                  required
                />
              </div>
              
              {apkUploadProgress > 0 && (
                <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${apkUploadProgress}%`, backgroundColor: theme.accent, height: '100%', transition: 'width 0.2s' }}></div>
                </div>
              )}
              
              <button 
                type="submit" 
                style={{ ...styles.button, opacity: apkUploadProgress > 0 ? 0.5 : 1 }}
                disabled={apkUploadProgress > 0}
              >
                {apkUploadProgress > 0 ? `SUBIENDO... ${apkUploadProgress}%` : 'SUBIR ARCHIVO'}
              </button>
            </form>
          </div>

          <div style={adminStyles.card}>
            <h3>📦 Archivos Disponibles ({apks.length})</h3>
            <div className="table-responsive">
              <table style={adminStyles.table}>
                <thead>
                  <tr>
                    <th style={adminStyles.th}>Nombre</th>
                    <th style={adminStyles.th}>Tamaño</th>
                    <th style={adminStyles.th}>Modificado</th>
                    <th style={adminStyles.th}>Enlace (Para TV)</th>
                    <th style={adminStyles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {apks.length === 0 ? (
                    <tr><td colSpan="5" style={{...adminStyles.td, textAlign: 'center', color: theme.text3}}>No hay archivos subidos</td></tr>
                  ) : apks.map(apk => (
                    <tr key={apk.name}>
                      <td style={adminStyles.td}><strong>{apk.name}</strong></td>
                      <td style={adminStyles.td}>{(apk.size / (1024 * 1024)).toFixed(2)} MB</td>
                      <td style={adminStyles.td}>{new Date(apk.created_at).toLocaleString()}</td>
                      <td style={adminStyles.td}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            readOnly 
                            value={`${window.location.origin}/api/downloads/${apk.name}`}
                            style={{ ...styles.input, marginBottom: 0, padding: '4px 8px', fontSize: '12px', width: '250px' }}
                          />
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              navigator.clipboard.writeText(`${window.location.origin}/api/downloads/${apk.name}`);
                              alert('Enlace copiado al portapapeles');
                            }}
                            style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(79,195,247,0.2)', border: 'none', color: theme.accent, cursor: 'pointer', fontSize: '12px' }}
                          >Copiar</button>
                        </div>
                      </td>
                      <td style={adminStyles.td}>
                        <button onClick={() => deleteApk(apk.name)} style={{ color: '#ff4f4f', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'adult' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div>
            <div style={adminStyles.card}>
              <h3>Configuración Parental</h3>
              <form className="admin-form-grid" onSubmit={saveAdultSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '14px' }}>Habilitar sección</label>
                  <input 
                    type="checkbox" 
                    checked={adultSettings.enabled} 
                    onChange={(e) => setAdultSettings({ ...adultSettings, enabled: e.target.checked })} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.text3, marginBottom: '5px' }}>TIEMPO DESBLOQUEO (MIN)</label>
                  <input type="number" style={styles.input} value={adultSettings.timeout} onChange={(e) => setAdultSettings({ ...adultSettings, timeout: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.text3, marginBottom: '5px' }}>CAMBIAR PIN (4 DÍGITOS)</label>
                  <input type="password" maxLength="4" style={styles.input} value={adultSettings.pin} onChange={(e) => setAdultSettings({ ...adultSettings, pin: e.target.value })} placeholder="Dejar en blanco para no cambiar" />
                </div>
                <button style={styles.button} type="submit">GUARDAR CONFIGURACIÓN</button>
              </form>
            </div>

            <div style={adminStyles.card}>
              <h3>Marcar Grupo Completo</h3>
              <p style={{ fontSize: '13px', color: theme.text3, marginBottom: '12px' }}>
                Marca todos los canales de un grupo como +18 de una vez
              </p>
              <select
                style={{ ...styles.input, marginBottom: '10px' }}
                id="bulk-group-select"
                defaultValue=""
              >
                <option value="">Seleccionar grupo...</option>
                {adultGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={{ ...styles.button, backgroundColor: 'rgba(255,79,79,0.2)', color: '#ff4f4f', padding: '8px' }}
                  onClick={async () => {
                    const g = document.getElementById('bulk-group-select').value;
                    if (!g) return alert('Selecciona un grupo');
                    if (!confirm(`¿Marcar TODOS los canales de "${g}" como +18?`)) return;
                    await axios.post(`${API_URL}/admin/channels/mark-group`, { group_title: g, is_adult: true }, config);
                    fetchAdultChannels();
                  }}
                >MARCAR TODO +18</button>
                <button
                  style={{ ...styles.button, backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px' }}
                  onClick={async () => {
                    const g = document.getElementById('bulk-group-select').value;
                    if (!g) return alert('Selecciona un grupo');
                    if (!confirm(`¿Quitar +18 de TODOS los canales de "${g}"?`)) return;
                    await axios.post(`${API_URL}/admin/channels/mark-group`, { group_title: g, is_adult: false }, config);
                    fetchAdultChannels();
                  }}
                >QUITAR +18</button>
              </div>
            </div>
          </div>

          <div style={adminStyles.card}>
            <h3>
              Gestión de Canales +18
              <span style={{ fontSize: '13px', fontWeight: '400', color: theme.text3, marginLeft: '10px' }}>
                {adultChannels.filter(c => c.is_adult).length} marcados como adultos
              </span>
            </h3>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                style={{ ...styles.input, flex: 1, minWidth: '150px', marginBottom: 0 }}
                placeholder="Buscar canal..."
                value={adultSearch}
                onChange={e => {
                  setAdultSearch(e.target.value);
                  fetchAdultChannels(e.target.value, adultGroupFilter, showAdultOnly);
                }}
              />
              <select
                style={{ ...styles.input, width: '180px', marginBottom: 0 }}
                value={adultGroupFilter}
                onChange={e => {
                  setAdultGroupFilter(e.target.value);
                  fetchAdultChannels(adultSearch, e.target.value, showAdultOnly);
                }}
              >
                <option value="">Todos los grupos</option>
                {adultGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={showAdultOnly}
                  onChange={e => {
                    setShowAdultOnly(e.target.checked);
                    fetchAdultChannels(adultSearch, adultGroupFilter, e.target.checked);
                  }}
                />
                Solo +18
              </label>
            </div>

            <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {adultChannels.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: theme.text3 }}>
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔞</div>
                  <div>No se encontraron canales</div>
                  <div style={{ fontSize: '12px', marginTop: '6px' }}>Busca por nombre o selecciona un grupo</div>
                </div>
              ) : (
                <table style={adminStyles.table}>
                  <thead>
                    <tr>
                      <th style={adminStyles.th}>Canal</th>
                      <th style={adminStyles.th}>Grupo</th>
                      <th style={adminStyles.th}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adultChannels.map(ch => (
                      <tr key={ch.id}>
                        <td style={adminStyles.td}>
                          {ch.is_adult === 1 && <span style={{ color: '#ff4f4f', marginRight: '5px' }}>🔞</span>}
                          {ch.name}
                        </td>
                        <td style={adminStyles.td}>{ch.group_title}</td>
                        <td style={adminStyles.td}>
                          <button 
                            onClick={() => toggleChannelAdult(ch.id, ch.is_adult)}
                            style={{ 
                              padding: '4px 12px', 
                              borderRadius: '4px', 
                              border: 'none',
                              backgroundColor: ch.is_adult === 1 ? 'rgba(255,79,79,0.15)' : 'rgba(255,255,255,0.05)',
                              color: ch.is_adult === 1 ? '#ff4f4f' : theme.text2,
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {ch.is_adult === 1 ? '✓ +18' : '+ MARCAR'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'dashboard' && (
        <AdminDashboard API_BASE={API_URL} token={token} />
      )}

      {tab === 'branding' && (
        <div style={adminStyles.card}>
          <h3>Configuración de Branding</h3>
          <form className="admin-form-grid" onSubmit={saveBranding} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: theme.text3, marginBottom: '8px' }}>NOMBRE DEL ISP</label>
              <input 
                style={styles.input} 
                value={branding.isp_name} 
                onChange={(e) => setBranding({ ...branding, isp_name: e.target.value })} 
                placeholder="Ej: Intertel-TV"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: theme.text3, marginBottom: '8px' }}>URL DEL LOGO (PNG/SVG)</label>
              <input 
                style={styles.input} 
                value={branding.isp_logo} 
                onChange={(e) => setBranding({ ...branding, isp_logo: e.target.value })} 
                placeholder="https://..."
              />
            </div>
            <div className="admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: theme.text3, marginBottom: '8px' }}>COLOR PRIMARIO</label>
                <input 
                  type="color"
                  style={{ ...styles.input, height: '45px', padding: '5px' }} 
                  value={branding.primary_color || '#007bff'} 
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: theme.text3, marginBottom: '8px' }}>COLOR SECUNDARIO</label>
                <input 
                  type="color"
                  style={{ ...styles.input, height: '45px', padding: '5px' }} 
                  value={branding.secondary_color || '#6c757d'} 
                  onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })} 
                />
              </div>
            </div>
            <button style={styles.button} type="submit">GUARDAR CAMBIOS</button>
          </form>
        </div>
      )}

      {tab === 'users' && (
        <div>
          {/* Add new user */}
          <div style={adminStyles.card}>
            <h3>➕ Agregar Nuevo Cliente / Administrador</h3>
            <form
              className="admin-form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const username = e.target.uname.value.trim();
                const password = e.target.upass.value.trim();
                const is_admin = e.target.uadmin.checked;
                if (!username || !password) return;
                try {
                  await axios.post(`${API_URL}/admin/users`, { username, password, is_admin }, config);
                  e.target.reset();
                  fetchAdminData();
                  alert(`Usuario "${username}" creado correctamente.`);
                } catch (err) {
                  alert(err.response?.data?.error || 'Error al crear usuario');
                }
              }}
              style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '12px', alignItems: 'end' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.text3, marginBottom: '6px' }}>USUARIO (CORREO / TEL)</label>
                <input name="uname" style={{ ...styles.input, marginBottom: 0 }} placeholder="Ej: cliente@correo.com" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.text3, marginBottom: '6px' }}>CONTRASEÑA</label>
                <input name="upass" type="password" style={{ ...styles.input, marginBottom: 0 }} placeholder="********" required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '45px' }}>
                <label style={{ fontSize: '12px', color: theme.text3, marginBottom: '4px' }}>¿ES ADMIN?</label>
                <input name="uadmin" type="checkbox" style={{ cursor: 'pointer', scale: '1.2' }} />
              </div>
              <button type="submit" style={{ ...styles.button, width: 'auto', padding: '12px 20px', whiteSpace: 'nowrap' }}>
                CREAR USUARIO
              </button>
            </form>
          </div>

          {/* Users list */}
          <div style={adminStyles.card}>
            <h3>Gestión de Usuarios ({users.length})</h3>
            <div className="table-responsive">
              <table style={adminStyles.table}>
                <thead>
                  <tr>
                    <th style={adminStyles.th}>Usuario</th>
                    <th style={adminStyles.th}>Admin</th>
                    <th style={adminStyles.th}>Creado</th>
                    <th style={adminStyles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={adminStyles.td}>{u.username}</td>
                      <td style={adminStyles.td}>{u.is_admin ? 'SÍ' : 'NO'}</td>
                      <td style={adminStyles.td}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={adminStyles.td}>
                        <button onClick={() => deleteUser(u.id, u.username)} style={{ color: '#ff4f4f', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'sources' && (
        <div>
          {/* Add new source */}
          <div style={adminStyles.card}>
            <h3>➕ Agregar Nueva Fuente M3U</h3>
            <form
              className="admin-form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const name = e.target.sname.value.trim();
                const url = e.target.surl.value.trim();
                if (!name || !url) return;
                try {
                  await axios.post(`${API_URL}/admin/sources`, { name, url, enabled: true }, config);
                  e.target.reset();
                  fetchAdminData();
                  alert(`Fuente "${name}" agregada. Se importará en el próximo ciclo de actualización.`);
                } catch (err) {
                  alert(err.response?.data?.error || 'Error al agregar fuente');
                }
              }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '12px', alignItems: 'end' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.text3, marginBottom: '6px' }}>NOMBRE</label>
                <input name="sname" style={{ ...styles.input, marginBottom: 0 }} placeholder="Ej: Lista Premium" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.text3, marginBottom: '6px' }}>URL DE LA LISTA M3U</label>
                <input name="surl" style={{ ...styles.input, marginBottom: 0 }} placeholder="http://..." required />
              </div>
              <button type="submit" style={{ ...styles.button, width: 'auto', padding: '12px 20px', whiteSpace: 'nowrap' }}>
                AGREGAR
              </button>
            </form>
          </div>

          {/* Sources list */}
          <div style={adminStyles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>📋 Fuentes Configuradas ({sources.length})</h3>
              <button
                onClick={handleRefresh}
                style={{ ...styles.button, width: 'auto', padding: '8px 20px', backgroundColor: 'rgba(79,195,247,0.15)', color: theme.accent }}
              >
                🔄 ACTUALIZAR TODOS AHORA
              </button>
            </div>

            {sources.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: theme.text3 }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📭</div>
                <div>No hay fuentes configuradas</div>
                <div style={{ fontSize: '12px', marginTop: '6px' }}>Agrega una URL M3U arriba para importar canales</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table style={adminStyles.table}>
                  <thead>
                    <tr>
                      <th style={adminStyles.th}>Nombre</th>
                      <th style={adminStyles.th}>URL</th>
                      <th style={adminStyles.th}>Canales</th>
                      <th style={adminStyles.th}>Última carga</th>
                      <th style={adminStyles.th}>Estado</th>
                      <th style={adminStyles.th}>Acciones</th>
                    </tr>
                  </thead>
                <tbody>
                  {sources.map(s => (
                    <tr key={s.id}>
                      <td style={adminStyles.td}><strong>{s.name}</strong></td>
                      <td style={{ ...adminStyles.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={s.url} style={{ fontSize: '12px', color: theme.text3 }}>{s.url}</span>
                      </td>
                      <td style={adminStyles.td}>
                        <span style={{ color: theme.accent, fontWeight: '700' }}>{s.last_channels || 0}</span>
                      </td>
                      <td style={adminStyles.td}>
                        <span style={{ fontSize: '12px' }}>
                          {s.last_fetch ? new Date(s.last_fetch).toLocaleString() : 'Nunca'}
                        </span>
                      </td>
                      <td style={adminStyles.td}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: s.enabled ? 'rgba(76,175,80,0.15)' : 'rgba(255,79,79,0.15)',
                          color: s.enabled ? '#4caf50' : '#ff4f4f'
                        }}>
                          {s.enabled ? '● ACTIVA' : '● INACTIVA'}
                        </span>
                      </td>
                      <td style={{ ...adminStyles.td, display: 'flex', gap: '8px' }}>
                        <button
                          onClick={async () => {
                            try {
                              await axios.put(`${API_URL}/admin/sources/${s.id}`, { enabled: !s.enabled }, config);
                              fetchAdminData();
                            } catch (err) { alert('Error'); }
                          }}
                          style={{ color: s.enabled ? '#ff9800' : '#4caf50', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          {s.enabled ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => deleteSource(s.id, s.name)}
                          style={{ color: '#ff4f4f', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom confirm modal - replaces native confirm() */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '380px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ fontSize: '16px', marginBottom: '24px', color: '#e2e0f0', lineHeight: 1.5 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: 'transparent', color: '#9896b0', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                style={{
                  padding: '10px 24px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#c62828', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '700'
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
