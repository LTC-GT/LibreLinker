import lume from "lume/mod.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import esbuild from "lume/plugins/esbuild.ts";
import gzip from "lume/plugins/gzip.ts";
import seo from "lume/plugins/seo.ts";

// Prepend LibreJS GPL-3.0-or-later license headers to all emitted JS bundles.
function librejs(): Lume.Plugin {
  const header =
    `/* @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later */\n`;
  const footer = `\n/* @license-end */\n`;

  return (site) => {
    site.process([".js"], (pages) => {
      for (const page of pages) {
        if (typeof page.content === "string") {
          page.content = header + page.content + footer;
        }
      }
    });
  };
}

const site = lume({
  location: new URL("https://librelinker.org"),
  dest: "dist",
});

site.use(tailwindcss());
site.use(esbuild());
site.use(librejs());
site.use(gzip());
site.use(seo({
  // Print to console only — writing to a file would trigger the FSWatcher and loop
  output: (errors) => {
    if (errors.size === 0) return;
    console.warn(`\n[seo] ${errors.size} issue(s) found:`);
    for (const [url, issues] of errors) {
      for (const issue of issues) {
        console.warn(`  ${url}: ${issue.title}`);
      }
    }
  },
  // body.min: 0 — JS renders all project content dynamically at runtime
  options: { body: { min: 0 } },
}));

// Exclude repo documentation and config files from the build output
site.ignore("README.md", "LICENSE.md", "AUTHORS.md", "CODE_OF_CONDUCT.md", "deno.json", "deno.lock");

// HTML pages
site.add("index.html");
site.add("404.html");

// CSS and JS processed through their respective plugins
site.add("src/styles.css");
site.add("app.js");

// Static assets copied verbatim
site.add("CNAME");
site.add("robots.txt");
site.add("sitemap.xml");
site.add("javascript-licenses.html");
site.add("projects.json");
site.add("misc");

export default site;
