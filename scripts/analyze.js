const fs = require('fs');

const html = fs.readFileSync('courses_page.html', 'utf8');

const hrefs = [];
const regex = /href=["']([^"']+)["']/g;
let match;
while ((match = regex.exec(html)) !== null) {
  hrefs.push(match[1]);
}

const uniqueHrefs = [...new Set(hrefs)].filter(h => 
  !h.endsWith('.css') && 
  !h.endsWith('.js') && 
  !h.endsWith('.ico') && 
  !h.startsWith('http://fonts') &&
  !h.startsWith('https://cdnjs')
);

console.log('Unique Links:', uniqueHrefs);

// Let's also inspect all h3, h4, h5, or card titles
const titles = [];
const titleRegex = /<(h[2-6]|a)[^>]*class=["'][^"']*(course|title|card)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
while ((match = titleRegex.exec(html)) !== null) {
  titles.push(match[3].replace(/<[^>]+>/g, '').trim());
}
console.log('Titles found with class course/title/card:', titles);

// Look for price or course blocks
const courseBlocks = [];
const blockRegex = /class=["']course-item[^"']*["'][\s\S]*?(?=class=["']course-item|$)/g;
while ((match = blockRegex.exec(html)) !== null) {
  courseBlocks.push(match[0].slice(0, 500));
}
console.log('course-item blocks count:', courseBlocks.length);
if (courseBlocks.length > 0) {
  console.log('Sample block:', courseBlocks[0]);
}
