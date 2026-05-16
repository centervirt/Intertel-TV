const Database = require('better-sqlite3');
const db = new Database('./iptv.db');

const expandedKeywords = [
  '%XXX%', '%Adult%', '%Porn%', '%Hentai%', '%Erotic%', '%Sex%', 
  '%Cam%', '%Anal%', '%Brazzers%', '%Bang%', '%Nude%', '%NSFW%', '%+18%'
];

let totalUpdated = 0;
expandedKeywords.forEach(kw => {
  const result = db.prepare(`
    UPDATE channels 
    SET is_adult = 1 
    WHERE (group_title LIKE ? OR name LIKE ?) 
      AND (name NOT LIKE '%Sexta%' AND name NOT LIKE '%Camara%')
  `).run(kw, kw);
  totalUpdated += result.changes;
});

console.log(`✅ Clasificación ampliada completada. ${totalUpdated} canales marcados como adultos.`);

// Verify "Niños" profile
const profile = db.prepare("SELECT * FROM profiles WHERE name = 'Niños'").get();
console.log('Profile Niños:', JSON.stringify(profile, null, 2));

db.close();
