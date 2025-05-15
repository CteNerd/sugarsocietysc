/**
 * Script to generate a sitemap.xml file for the Sugar Society website
 * Run with: node generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

// Configure base URL and routes
const baseUrl = 'https://sugarsocietysc.com';
const routes = [
  { path: '/', lastmod: new Date().toISOString().split('T')[0], changefreq: 'weekly', priority: '1.0' },
  { path: '/our-story', lastmod: new Date().toISOString().split('T')[0], changefreq: 'monthly', priority: '0.8' },
  { path: '/specials', lastmod: new Date().toISOString().split('T')[0], changefreq: 'weekly', priority: '0.9' },
  { path: '/our-cookies', lastmod: new Date().toISOString().split('T')[0], changefreq: 'weekly', priority: '0.9' },
  { path: '/order-now', lastmod: new Date().toISOString().split('T')[0], changefreq: 'weekly', priority: '0.9' },
  { path: '/contact', lastmod: new Date().toISOString().split('T')[0], changefreq: 'monthly', priority: '0.8' },
  { path: '/privacy', lastmod: new Date().toISOString().split('T')[0], changefreq: 'yearly', priority: '0.5' },
];

// Generate sitemap XML
const generateSitemap = () => {
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  routes.forEach(route => {
    sitemap += '  <url>\n';
    sitemap += `    <loc>${baseUrl}${route.path}</loc>\n`;
    sitemap += `    <lastmod>${route.lastmod}</lastmod>\n`;
    sitemap += `    <changefreq>${route.changefreq}</changefreq>\n`;
    sitemap += `    <priority>${route.priority}</priority>\n`;
    sitemap += '  </url>\n';
  });
  
  sitemap += '</urlset>';
  
  return sitemap;
};

// Write sitemap to file
const writeSitemap = (sitemap) => {
  const outputPath = path.resolve(__dirname, 'public', 'sitemap.xml');
  
  fs.writeFileSync(outputPath, sitemap);
  console.log(`Sitemap generated at ${outputPath}`);
};

// Execute
const sitemap = generateSitemap();
writeSitemap(sitemap);
