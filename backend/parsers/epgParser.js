const { XMLParser } = require('fast-xml-parser');

function parseEPGDate(dateStr) {
  if (!dateStr) return null;
  // Format: 20240115183000 +0000
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s?([+-]\d{4})?$/);
  if (!match) return null;
  
  const [_, year, month, day, hour, min, sec, tz] = match;
  const isoDate = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
  return new Date(isoDate).toISOString();
}

function parseEPG(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
  });
  
  const jsonObj = parser.parse(xmlContent);
  const tv = jsonObj.tv;
  if (!tv || !tv.programme) return [];

  const programmes = Array.isArray(tv.programme) ? tv.programme : [tv.programme];
  
  return programmes.map(p => ({
    channel_id: p.channel,
    title: typeof p.title === 'string' ? p.title : p.title?.['#text'] || '',
    start: parseEPGDate(p.start),
    stop: parseEPGDate(p.stop),
    description: typeof p.desc === 'string' ? p.desc : p.desc?.['#text'] || ''
  }));
}

module.exports = { parseEPG };
