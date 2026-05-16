function parseM3U(content) {
  const lines = content.split('\n');
  const channels = [];
  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Parse attributes
      const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] || '';
      const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || '';
      const tvgLogo = line.match(/tvg-logo="([^"]*)"/)?.[1] || '';
      const groupTitle = line.match(/group-title="([^"]*)"/)?.[1] || '';
      const country = line.match(/tvg-country="([^"]*)"/)?.[1] || '';
      const language = line.match(/tvg-language="([^"]*)"/)?.[1] || '';

      // Name is after the last comma
      const nameParts = line.split(',');
      const name = nameParts[nameParts.length - 1].trim();

      currentChannel = {
        name,
        tvg_id: tvgId || tvgName,
        logo: tvgLogo,
        group: groupTitle,
        country,
        language
      };
    } else if (!line.startsWith('#') && currentChannel) {
      currentChannel.url = line;
      channels.push(currentChannel);
      currentChannel = null;
    }
  }

  return channels;
}

module.exports = { parseM3U };
