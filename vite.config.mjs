import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Simple Vite plugin to prepend LibreJS license magnet link to all emitted JavaScript.
const libreJsPlugin = () => {
  const licenseText = `/* @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later */\n`;
  const licenseEndText = `\n/* @license-end */\n`;
  let isBuild = false;

  return {
    name: 'librejs-plugin',
    enforce: 'post',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    // For Production: prepend to chunks
    renderChunk(code, chunk) {
      if (chunk.fileName.endsWith('.js') || chunk.fileName.endsWith('.mjs') || chunk.fileName.endsWith('.cjs')) {
        return licenseText + code + licenseEndText;
      }
      return null;
    },
    // For Development: intercept server responses to wrap the *entire* generated response
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const originalEnd = res.end;
        res.end = function (chunk, encoding, callback) {
          // Only intercept JavaScript files/modules
          const contentType = res.getHeader('Content-Type');
          if (typeof contentType === 'string' && contentType.includes('javascript') && chunk) {
            const body = chunk.toString('utf8');
            const newBody = licenseText + body + licenseEndText;
            res.setHeader('Content-Length', Buffer.byteLength(newBody));
            return originalEnd.call(this, newBody, encoding, callback);
          }
          return originalEnd.call(this, chunk, encoding, callback);
        };
        next();
      });
    }
  };
};

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
// Relative base avoids broken assets on project pages and custom domains.
const base = isGitHubPages ? './' : '/';

export default defineConfig({
  base,
  plugins: [
    libreJsPlugin(),
    viteStaticCopy({
      targets: [
        { src: 'CNAME', dest: '' },
        { src: '404.html', dest: '' },
        { src: 'projects.json', dest: '' },
        { src: 'robots.txt', dest: '' },
        { src: 'sitemap.xml', dest: '' },
        { src: 'javascript-licenses.html', dest: '' },
        { src: 'misc', dest: '' }
      ]
    })
  ]
});
