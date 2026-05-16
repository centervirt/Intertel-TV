const Database = require('better-sqlite3');
const db = new Database('./iptv.db');

const leaky = db.prepare(`
  SELECT name, group_title, is_adult 
  FROM channels 
  WHERE (group_title LIKE '%XXX%' 
     OR group_title LIKE '%Adult%' 
     OR name LIKE '%AdultIPTV%') 
    AND is_adult = 0
`).all();

console.log('Leaky channels:', JSON.stringify(leaky, null, 2));

if (leaky.length > 0) {
  console.log('Fixing leaks...');
  db.prepare(`
    UPDATE channels 
    SET is_adult = 1 
    WHERE (group_title LIKE '%XXX%' 
       OR group_title LIKE '%Adult%' 
       OR name LIKE '%AdultIPTV%') 
      AND is_adult = 0
  `).run();
  console.log('Fixed.');
}

db.close();
