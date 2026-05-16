const Database = require('better-sqlite3');
const db = new Database('./iptv.db');

// Simulation of Kids Profile Request
const profileLevel = 1;
const isAdultUnlocked = false; // No adult token
const isAdultProfile = profileLevel >= 3;

let baseQuery = 'FROM channels WHERE is_enabled = 1';
const params = [];

if (!isAdultUnlocked && !isAdultProfile) {
  baseQuery += ' AND is_adult = 0';
}

const count = db.prepare(`SELECT COUNT(*) as count ${baseQuery}`).get(...params).count;
const adultVisible = db.prepare(`SELECT COUNT(*) as count ${baseQuery} AND (group_title LIKE '%XXX%' OR group_title LIKE '%Adult%')`).get(...params).count;

console.log('Total visible to Kids:', count);
console.log('Adult channels visible to Kids (by name/group):', adultVisible);

if (adultVisible > 0) {
  const samples = db.prepare(`SELECT name, group_title, is_adult ${baseQuery} AND (group_title LIKE '%XXX%' OR group_title LIKE '%Adult%') LIMIT 5`).all(...params);
  console.log('Samples of leaks:', JSON.stringify(samples, null, 2));
}

db.close();
