const Database = require('better-sqlite3');
const db = new Database('./iptv.db');
const results = db.prepare(`
  SELECT id, name, group_title 
  FROM channels 
  WHERE group_title LIKE '%Adult%' 
     OR group_title LIKE '%XXX%' 
     OR name LIKE '%Adult%' 
     OR name LIKE '%XXX%'
     OR group_title LIKE '%Porn%'
     OR name LIKE '%Porn%'
  LIMIT 50
`).all();
console.log(JSON.stringify(results, null, 2));
db.close();
