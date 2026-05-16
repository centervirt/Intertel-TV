const Database = require('better-sqlite3');
const db = new Database('iptv.db');
const alertService = require('./services/alertService');

async function testAutoRecovery() {
  console.log('--- INICIANDO TEST DE AUTO-RECOVERY (SELF-HEALING) ---');
  
  const firstChannel = db.prepare("SELECT id, name FROM channels LIMIT 1").get();
  const channelId = firstChannel.id;
  const channelName = firstChannel.name;
  
  // Reset
  db.prepare("UPDATE channels SET fail_count = 0, success_count = 0, status = 'active', is_enabled = 1 WHERE id = ?").run(channelId);
  console.log(`Canal: ${channelName} | ID: ${channelId} | Estado inicial: ACTIVE`);

  // 1. Simular caída profunda (5 fallos)
  console.log('\n--- SIMULANDO CAÍDA (5 FALLOS) ---');
  for (let i = 1; i <= 5; i++) {
    let status = i >= 5 ? 'maintenance' : (i >= 3 ? 'unstable' : 'warning');
    let is_enabled = i >= 5 ? 0 : 1;
    db.prepare('UPDATE channels SET is_online = 0, fail_count = ?, success_count = 0, status = ?, is_enabled = ? WHERE id = ?')
      .run(i, status, is_enabled, channelId);
    console.log(`Fallo #${i} -> Estado: ${status} | Enabled: ${is_enabled}`);
  }

  // 2. Simular recuperación (3 éxitos)
  console.log('\n--- SIMULANDO RECUPERACIÓN (3 ÉXITOS) ---');
  for (let i = 1; i <= 3; i++) {
    if (i === 3) {
      db.prepare("UPDATE channels SET is_online = 1, is_enabled = 1, fail_count = 0, success_count = ?, status = 'active' WHERE id = ?")
        .run(i, channelId);
      alertService.createAlert(`Canal recuperado automáticamente: ${channelName}`, 'info');
    } else {
      db.prepare('UPDATE channels SET is_online = 1, fail_count = 0, success_count = ? WHERE id = ?')
        .run(i, channelId);
    }
    const ch = db.prepare("SELECT status, is_enabled, success_count FROM channels WHERE id = ?").get(channelId);
    console.log(`Éxito #${i} -> Estado: ${ch.status} | Enabled: ${ch.is_enabled} | Success Count: ${ch.success_count}`);
  }

  // 3. Verificar Alertas
  const alert = db.prepare("SELECT * FROM alerts WHERE message LIKE 'Canal recuperado%' ORDER BY created_at DESC LIMIT 1").get();
  console.log('\n--- VERIFICACIÓN FINAL ---');
  if (alert) {
    console.log(`¡ÉXITO! Alerta detectada: ${alert.message}`);
  } else {
    console.log('ERROR: No se generó alerta de recuperación.');
  }

  console.log('\n--- TEST FINALIZADO ---');
}

testAutoRecovery();
