import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isUserOrOrgPage = repoName?.endsWith('.github.io');
const base = process.env.GITHUB_PAGES === 'true' && repoName && !isUserOrOrgPage
  ? `/${repoName}/`
  : '/';

export default defineConfig({
  base,
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'projects.json', dest: '' },
        { src: 'robots.txt', dest: '' },
        { src: 'sitemap.xml', dest: '' },
        { src: 'javascript-licenses.html', dest: '' },
        { src: 'misc', dest: '' }
      ]
    })
  ]
});
