# Yuqi Zhang — Personal Website

Personal website of **Yuqi Zhang**, a Ph.D. student in Astronomy at Boston University,
working on space physics, planetary science, and AI-assisted computational research.

> ⚠️ This site is **under active development** and will be continuously updated.

## Sections

- **Home** — introduction and profile links
- **About** — education, work experience, awards, research interests, biography
- **Research**
- **Projects**
- **Publications**
- **Skills**
- **Contact**
- **CV** — downloadable resume (in [`cv1_yuqi/`](cv1_yuqi/))

The top navigation opens one section at a time. Each section has a shareable
URL (for example, `index.html#research`), and browser Back/Forward works between
sections. Refreshing keeps the selected section. Longer sections scroll normally.
Without JavaScript, all sections remain available as a standard document.

## Geographic life trajectory

The bottom of **About** contains a dark map and a stay log. First-level regions
are enabled by default. The three checkboxes allow any combination of
states/provinces, prefecture-level cities/counties, and 0.5° × 0.5°
longitude/latitude cells, including background-only. First-level fills sit below
second-level fills, with precise cells on top. Each layer shows its actual
shapes without extra location markers. Click a city in the table to focus the
most detailed enabled layer. Second-level mode also shows first-level boundary
lines. Precise location mode shows both first- and second-level boundary lines,
even when their fills are disabled. Scroll over
the map to zoom; the view buttons focus World, China, the contiguous US, or Europe.

### Updating your stays

Edit **[`data/life-trajectory.csv`](data/life-trajectory.csv)**, save it, and
refresh the website. Both the map and the stay log read this file directly;
there is no copy of the visit data in JavaScript and no build step. You can edit
the CSV in a text editor or spreadsheet app (save as UTF-8 CSV).

| Column | What to enter |
| --- | --- |
| `id` | A unique name for this stay, such as `dalian` or `boston-2026`. Use another ID for a repeat visit. |
| `city` | City name displayed in the table. |
| `state_province` | State/province name displayed in the table. |
| `country` | Country name in English, or its two-letter code. |
| `purpose` | `study` (red), `travel` (yellow), `live` (green), or `transfer` (cyan). |
| `start` | Start date, in `YYYY-MM-DD` format. |
| `end` | End date, in `YYYY-MM-DD` format; use `Present` or leave blank for an ongoing stay. |
| `longitude` | Decimal degrees, −180 to 180. West is negative. |
| `latitude` | Decimal degrees, −90 to 90. South is negative. |
| `city_zh` | Optional Chinese city name, such as `大连`. Shown in brackets after the English name for stays in China. |
| `state_province_zh` | Optional Chinese province name, such as `辽宁`, displayed the same way. |

Use `YYYY-MM` when only the month is known. Use `Live (weekends)` for a recurring weekend stay in the green Live category.

Add a row for each stay. Overlapping dates are allowed, and rows appear in file
order. Quote text containing commas. Invalid dates, coordinates, or duplicate
IDs produce a visible message with the CSV row number. **Download CSV** exports
the loaded records in an editable format, including optional `region1`/`region2`
columns; normally these can stay blank because region assignment is automatic.

Coordinates determine the map location and administrative regions. Visits use approximate place coordinates. A region takes the highest-priority
purpose present there. First-level regions use study/work → travel → live → transfer.
Second-level regions and precise cells use live → study/work → travel → transfer.
Each layer applies its own rule when combined with others.

The local boundary data includes global first-level regions and all available
Chinese prefectures and U.S. counties. New cities in those countries need only
a CSV row; Boston resolves to Suffolk County. Elsewhere, precise cells and the
stay log still work, with first-level fills wherever the source covers the
location. After updating the CSV or boundaries, run `node scripts/report-about.cjs`
to refresh the coverage details in [report_about.log](report_about.log).
Additional regional coverage can be bundled using the instructions in
[`assets/geography/SOURCES.md`](assets/geography/SOURCES.md).

Country, first-level, second-level, and disputed boundary styles follow the
[reference travel map](https://zesen.me/travel/). Disputed outlines and their
hover/click notes come from Natural Earth's dataset. Geometry and Leaflet are
bundled locally and load when the atlas is approached; no API key or remote
tile service is needed. JavaScript and an HTTP server are required to read CSV.

Checks: `node tests/trajectory-data.test.cjs` and
`node tests/trajectory-regions.test.cjs`.

## CV Template

The CV in [`cv1_yuqi/`](cv1_yuqi/) is typeset with the
**[Academic-LaTeX](https://github.com/CunchuanHuang/Academic-LaTeX)** template.

## Local Preview

From this directory, run:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:8765/). Use the server instead of opening
`index.html` as a file, because browsers restrict reading CSV through `file://`.
There is no build step or JavaScript package installation.

## Repository

Source code and assets for the website. The `cv1_yuqi/` directory also contains the
LaTeX source of the CV; the compiled `main.pdf` is what the website links to.
