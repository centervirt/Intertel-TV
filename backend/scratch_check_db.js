const Database = require('better-sqlite3');
const db = new Database('./iptv.db');
const count = db.prepare('SELECT COUNT(*) as count FROM channels').get().count;
const samples = db.prepare('SELECT name, url FROM channels LIMIT 5').all();
console.log('Total Channels:', count);
console.log('Samples:', JSON.stringify(samples, null, 2));
db.close();
