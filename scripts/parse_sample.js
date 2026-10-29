const fs = require('fs');
const html = fs.readFileSync('curso19.html', 'utf8');

// Strip tags and clean whitespace
function clean(str) {
  return str.replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join('\n');
}

const cleaned = clean(html);
fs.writeFileSync('curso19_clean.txt', cleaned, 'utf8');
console.log('Sample text (first 1500 chars):\n', cleaned.slice(0, 1500));
