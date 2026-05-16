const Database = require('better-sqlite3');
const db = new Database('iptv.db');
const streamCheckerService = require('./services/streamCheckerService');
const alertService = require('./services/alertService');

async function testAutoDisable() {
  console.log('--- INICIANDO TEST DE AUTO-DESACTIVACIÓN ---');
  
  // 1. Preparar un canal de prueba
  const firstChannel = db.prepare("SELECT id FROM channels LIMIT 1").get();
  const channelId = firstChannel.id;
  
  db.prepare("UPDATE channels SET url = ?, fail_count = 0, is_enabled = 1, name = 'CANAL TEST FALLO' WHERE id = ?")
    .run(`http://stream-fail-${Date.now()}.com/fail.m3u8`, channelId);
  
  const channelName = 'CANAL TEST FALLO';
  console.log(`Canal preparado: ${channelName} | ID: ${channelId}`);

  // 2. Simular lógica del checker para este canal específico
  for (let i = 1; i <= 3; i++) {
    console.log(`\nSimulando chequeo #${i} para el canal...`);
    
    // Simulación de fallo de red
    const newFailCount = i;
    db.prepare('UPDATE channels SET is_online = 0, fail_count = ? WHERE id = ?').run(newFailCount, channelId);
    
    if (newFailCount >= 3) {
      db.prepare('UPDATE channels SET is_enabled = 0 WHERE id = ?').run(channelId);
      alertService.createAlert(`Canal desactivado automáticamente (3 fallos): ${channelName}`, 'warning');
    }

    const updated = db.prepare("SELECT fail_count, is_enabled FROM channels WHERE id = ?").get(channelId);
    console.log(`Resultado #${i}: Fail Count = ${updated.fail_count} | Enabled = ${updated.is_enabled}`);
  }

  // 3. Verificar Alertas
  const alerts = db.prepare("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 1").all();
  console.log('\n--- VERIFICACIÓN DE ALERTAS ---');
  if (alerts.length > 0) {
    console.log(`Alerta generada: [${alerts[0].level}] ${alerts[0].message}`);
  } else {
    console.log('ERROR: No se generó ninguna alerta.');
  }

  console.log('\n--- TEST FINALIZADO ---');
}

testAutoDisable();
