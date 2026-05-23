# 🐝 LibreLinker

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

LibreLinker showcases free, libre, & open-source projects developed by the Georgia Tech community. Our mission is to connect ideas and build tomorrow by highlighting projects that respect user freedom and follow GPL-compatible licenses.

LibreLinker is proudly built with 100% free software components!

## Project Categories

- **AI/ML**: Artificial intelligence and machine learning projects
- **Hardware**: FPGA, GPU, and hardware-focused research
- **Research**: Academic research tools and frameworks
- **Academic**: Educational resources and textbooks

## Technology Stack

- **Build**: [Lume](https://lume.land/) static site generator for Deno — GPL-3.0-or-later
- **Styling**: Tailwind CSS v4 — MIT License
- **Email**: EmailJS for client-side email delivery — Expat (MIT) License
- **Analytics**: Simple Analytics (privacy-first, GDPR compliant) — MIT License
- **Bot Protection**: Custom CAPTCHA solution — GPL-3.0-or-later (this project)

## Local Development

1. Install [Deno](https://deno.land/) v2.x
2. Clone the repository
3. Start the dev server with live reload:
   ```bash
   deno task dev
   ```
4. Navigate to `http://localhost:3000`

To build for production:
```bash
deno task build
# Output written to dist/
```

## Adding a Project

To add your project to LibreLinker:

1. Visit the website and use the "Get In Contact" form
2. Select "New Project Addition Request"
3. Confirm your project uses a GPL-compatible license
4. Provide project details in the message

Your project must:
- Be free software with a [GPL-compatible license](https://www.gnu.org/licenses/license-list.html#GPLCompatibleLicenses)
- Have a Georgia Tech affiliation (contributor, researcher, or student)
- Be actively maintained or of significance (TBD by the LibreTech Collective)

## Project Structure

```
librelinker/
├── _config.ts              # Lume build configuration
├── deno.json               # Deno tasks and import map
├── app.js                  # Main application logic (GPL-3.0-or-later)
├── index.html              # Main page
├── 404.html                # Error page
├── javascript-licenses.html # LibreJS machine-readable license table
├── projects.json           # Project data
├── robots.txt              # Search engine crawl rules
├── sitemap.xml             # Sitemap for SEO
├── CNAME                   # GitHub Pages custom domain
├── src/
│   └── styles.css          # Tailwind v4 entry point
├── misc/
│   ├── img/                # Images and assets
│   └── logos/              # Project logos
└── .github/workflows/
    └── deploy.yml          # GitHub Pages deployment via Deno
```

## License

All persons who contribute to this project are listed in the [AUTHORS.md](AUTHORS.md) file.

This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later).

See the [LICENSE](LICENSE.md) file for details.

## Contact

This project is open to pull requests and contributions. For inquiries or to submit your project, please contact us:

- **Organization**: [LibreTech Collective @ Georgia Tech](https://ltc.gtorg.gatech.edu/)
- **Email**: gtltc@protonmail.com

---

*Connecting Ideas, Building Tomorrow, Fighting for Freedom*
