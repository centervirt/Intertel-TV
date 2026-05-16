const Database = require('better-sqlite3');
const db = new Database('./iptv.db');

const keywords = ['%Adult%', '%XXX%', '%Porn%', '%Hentai%', '%Erotic%', '%Sex%'];
let totalUpdated = 0;

keywords.forEach(kw => {
  const result = db.prepare(`
    UPDATE channels 
    SET is_adult = 1 
    WHERE group_title LIKE ? OR name LIKE ?
  `).run(kw, kw);
  totalUpdated += result.changes;
});

console.log(`✅ Clasificación completada. ${totalUpdated} canales marcados como adultos.`);
db.close();
