import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const styles = {
  container: {
    padding: '20px',
    color: '#fff',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '10px 0',
    color: '#007bff',
  },
  statLabel: {
    fontSize: '14px',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  chartContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
    height: '300px',
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px',
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    color: '#aaa',
    fontSize: '12px',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: '14px',
  },
  alertBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
  }
};

const AdminDashboard = ({ API_BASE, token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/admin/dashboard`, {
      headers: { 'x-auth-token': token }
    })
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  if (loading || !data) return <div>Cargando dashboard...</div>;

  const { metrics, topChannels, streamErrors, alerts } = data;

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Viewers Concurrentes</span>
          <span style={styles.statValue}>{metrics.concurrentViewers}</span>
          <span style={{ color: '#28a745', fontSize: '12px' }}>● En vivo ahora</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Consumo Hoy</span>
          <span style={styles.statValue}>{metrics.dailyMinutes} <small style={{ fontSize: '14px' }}>min</small></span>
          <span style={{ color: '#aaa', fontSize: '12px' }}>Tiempo total de visualización</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Estado de Canales</span>
          <span style={styles.statValue}>{metrics.totalChannels - metrics.offlineChannels}/{metrics.totalChannels}</span>
          <span style={{ color: metrics.offlineChannels > 0 ? '#ff4f4f' : '#28a745', fontSize: '12px' }}>
            {metrics.offlineChannels} offline | {metrics.maintenanceChannels} mantenimiento
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={styles.chartContainer}>
          <h3 style={styles.sectionTitle}>Canales más vistos</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={topChannels}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                itemStyle={{ color: '#007bff' }}
              />
              <Bar dataKey="plays" fill="#007bff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartContainer}>
          <h3 style={styles.sectionTitle}>Alertas Recientes</h3>
          {alerts.length === 0 ? (
            <div style={{ color: '#666', fontSize: '14px' }}>No hay alertas nuevas.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.map(alert => (
                <div key={alert.id} style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '13px', borderLeft: `3px solid ${alert.level === 'warning' ? '#ffc107' : '#ff4f4f'}` }}>
                  {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ ...styles.chartContainer, height: 'auto' }}>
        <h3 style={styles.sectionTitle}>Canales con más errores</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>CANAL</th>
              <th style={styles.th}>TOTAL ERRORES</th>
              <th style={styles.th}>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {streamErrors.map((err, i) => (
              <tr key={i}>
                <td style={styles.td}>{err.name}</td>
                <td style={{ ...styles.td, color: '#ff4f4f', fontWeight: 'bold' }}>{err.errors}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.alertBadge, backgroundColor: 'rgba(255,79,79,0.1)', color: '#ff4f4f' }}>
                    REVISIÓN REQUERIDA
                  </span>
                </td>
              </tr>
            ))}
            {streamErrors.length === 0 && (
              <tr><td colSpan="3" style={{ ...styles.td, textAlign: 'center', color: '#666' }}>Sin errores reportados recientemente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
