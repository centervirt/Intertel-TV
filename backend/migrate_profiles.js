const Database = require('better-sqlite3');
const db = new Database('./iptv.db');

// Downgrade Principal
db.prepare("UPDATE profiles SET access_level = 1 WHERE name = 'Principal'").run();
console.log('✅ Perfil Principal bajado a nivel 1 (Familiar)');

// Ensure 'Papa' exists and is type adult
const papa = db.prepare("SELECT * FROM profiles WHERE name = 'Papa'").get();
if (!papa) {
  // If not, we tell the user or create a generic adult profile
  console.log('ℹ️ Recuerda crear un perfil de tipo "Adulto" para ver ese contenido.');
} else {
  db.prepare("UPDATE profiles SET type = 'adult', access_level = 3 WHERE name = 'Papa'").run();
  console.log('✅ Perfil Papa configurado como Adulto (Nivel 3)');
}

db.close();
