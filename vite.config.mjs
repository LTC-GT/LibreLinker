import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
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
