import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
// Relative base avoids broken assets on project pages and custom domains.
const base = isGitHubPages ? './' : '/';

export default defineConfig({
  base,
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'CNAME', dest: '' },
        { src: 'projects.json', dest: '' },
        { src: 'robots.txt', dest: '' },
        { src: 'sitemap.xml', dest: '' },
        { src: 'javascript-licenses.html', dest: '' },
        { src: 'misc', dest: '' }
      ]
    })
  ]
});
