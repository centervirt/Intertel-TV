const Database = require('better-sqlite3');
const db = new Database('./iptv.db');

// Revert false positives
const falsePositives = ['%Sexta%'];
falsePositives.forEach(fp => {
  db.prepare('UPDATE channels SET is_adult = 0 WHERE name LIKE ?').run(fp);
});

console.log('✅ Falsos positivos corregidos (La Sexta desbloqueada).');
db.close();
