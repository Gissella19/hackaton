const fs = require('fs');
const html = fs.readFileSync('courses_page.html', 'utf8');

// Find all matches for curso\d+\.php
const regex = /<a[^>]*href=["'](curso\d+\.php[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
let match;
const courseLinks = [];
while ((match = regex.exec(html)) !== null) {
  courseLinks.push({
    href: match[1],
    text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  });
}
console.log('Found course links count:', courseLinks.length);
console.log(JSON.stringify(courseLinks, null, 2));
