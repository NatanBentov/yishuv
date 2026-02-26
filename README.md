# 🏘️ מדרג הישובים — Israel Settlement Ranker

A mobile-first Hebrew web app for exploring, comparing, and ranking settlements (יישובים) in Israel using official government data.

**[Live Demo →](https://natanbentov.github.io/yishuv/)**

![Hebrew](https://img.shields.io/badge/language-Hebrew-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Data](https://img.shields.io/badge/data-data.gov.il-orange)

## Features

- **📊 Leaderboard** — Browse all ~1,300 settlements sorted by 11 categories (population, median wage, socio-economic cluster, academic %, etc.)
- **⭐ Favorites** — Save settlements to a personal favorites list (persisted in localStorage)
- **🔧 Advanced Filters** — Filter by population range, socio-economic cluster, religion, density, and more
- **📥 CSV Export** — Select settlements and export to Excel-compatible CSV (UTF-8 with BOM)
- **📱 Mobile-First** — Designed for phones, works on desktop too
- **🇮🇱 RTL Hebrew** — Fully right-to-left interface

## Data Sources

All data is fetched live from [data.gov.il](https://data.gov.il) (Israel's open data portal):

| Source | Description |
|--------|-------------|
| [Population by Age](https://data.gov.il/dataset/residents_in_israel_by_communities_and_டage_groups) | Population & age group breakdown per settlement |
| [Census 2022](https://data.gov.il/dataset/census-2022) | Density, median age/wage, academic %, employment, household size, religion, etc. |
| [Socio-Economic Index](https://data.gov.il/dataset/socio-economic) | Socio-economic cluster (1–10) per settlement |

## Tech Stack

- **Vanilla JS** — No frameworks, no build step
- **Single-page app** — 4 files, ~2,000 lines total
- **CSS Variables** — Consistent theming
- **Google Fonts** — Heebo for Hebrew typography

## Getting Started

No build tools required. Just serve the files:

```bash
# Clone
git clone https://github.com/NatanBentov/yishuv.git
cd yishuv

# Serve locally (any static server works)
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Project Structure

```
├── index.html   # App shell — screens, modal, header
├── app.js       # UI logic — navigation, rendering, favorites, export
├── data.js      # Data layer — API fetch, merge, processing
└── style.css    # All styles — mobile-first, RTL
```

## Deployment

Hosted on [GitHub Pages](https://pages.github.com/). Any push to `main` auto-deploys.

## License

[MIT](LICENSE)
