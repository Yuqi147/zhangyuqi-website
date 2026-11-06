# Geographic life trajectory: map data

The locally bundled map contains country outlines, complete China/US
administrative layers, a worldwide first-level background, and a separate
Natural Earth disputed-area overlay. It requires no map service or API token.
All three JavaScript data files load locally, including when the site is opened
directly from `index.html`.

## Attribution and licenses

### Country backdrop

- **Natural Earth**, Admin 0 — Countries, 1:110 million.
- License: [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
- [Pinned source GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_110m_admin_0_countries.geojson).
- Credit: Made with Natural Earth. Free vector and raster map data at
  [naturalearthdata.com](https://www.naturalearthdata.com/).
- The **China and United States** features are replaced with the more detailed
  country outlines from the same geoBoundaries releases used below. This avoids
  drawing coarse Natural Earth coastlines beneath detailed province/city
  highlights when the map is zoomed in. The other 175 features continue to use
  the Natural Earth backdrop.

### Worldwide first-level background

- **Natural Earth**, Admin 1 — States and Provinces, 1:10 million.
- License: [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
- [Pinned source GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_1_states_provinces.geojson).
- All source features outside the areas already covered by the complete
  geoBoundaries China/US releases are retained: **4,459 features**. Source
  administrative IDs, ISO country codes, ISO 3166-2 values, and country names
  are retained for coordinate-based first-level lookup outside China/USA.
- Duplicate source country/group codes excluded here are `CHN`, `HKG`, `MAC`,
  `TWN`, `USA`, `PRI`, `GUM`, `VIR`, `ASM`, and `MNP`, because those areas are
  present in the selected geoBoundaries layers.

### Disputed-area overlay

- **Natural Earth**, Admin 0 — Breakaway and Disputed Areas, 1:10 million;
  **99 polygon features**.
- License: [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
- [Pinned source GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_disputed_areas.geojson).
- Names use source `BRK_NAME`, falling back to `NAME_LONG` or `NAME`. The
  `claims` property is copied **verbatim** from `NOTE_BRK`; no claimants or
  administrative status are inferred. `featureClass`, `sourceType`,
  `sourceAdmin`, `sourceName`, and `sourceBreakawayCode` retain the relevant
  source classification/identifiers for inspection.
- This source includes claim areas, breakaway territories, leases, and other
  overlays, not solely active conflicts. Its labels describe the pinned
  dataset. See [Natural Earth's boundary policy](https://www.naturalearthdata.com/about/disputed-boundaries-policy/).
- Draw this layer separately with a neutral dashed outline and source-labelled
  popups; it does not assign visit categories or decide sovereignty.

### China outline, provinces, and prefecture-level cities

- **Humanitarian Data Exchange (HDX), China — Subnational Administrative
  Boundaries**, redistributed through **geoBoundaries gbHumanitarian**.
- License: [Creative Commons Attribution 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/),
  as recorded in the geoBoundaries metadata.
- [HDX source dataset](https://data.humdata.org/dataset/cod-ab-chn).
- Source year represented: **2020**. geoBoundaries build: December 12, 2023;
  pinned repository revision: `9469f09`.
- Country metadata: [CHN ADM0](https://www.geoboundaries.org/api/current/gbHumanitarian/CHN/ADM0/),
  boundary ID `CHN-ADM0-67760155`, source feature `67760155B85615447824908`.
- Province metadata: [CHN ADM1](https://www.geoboundaries.org/api/current/gbHumanitarian/CHN/ADM1/),
  boundary ID `CHN-ADM1-69067883`.
- Prefecture metadata: [CHN ADM2](https://www.geoboundaries.org/api/current/gbHumanitarian/CHN/ADM2/),
  boundary ID `CHN-ADM2-99377448`.
- The **gbHumanitarian** release is deliberately used: gbOpen's CHN ADM2
  release contains county-level features, which would not represent the
  prefecture-level city areas requested here.
- All **34 first-level** and **361 second-level** features in the source
  release are retained, including the source's municipalities and special
  administrative units. `sourceCountry` identifies the release grouping;
  source grouping and names are preserved without making a new status claim.
- The source province and city geometries are already simplified by
  geoBoundaries. This site normalizes IDs, retains names, and rounds coordinates;
  the original dataset authors have not endorsed this site.

### United States outline, Massachusetts, and Suffolk County

- **United States Census Bureau, MAF/TIGER Database**, redistributed through
  **geoBoundaries gbOpen**.
- Underlying boundary license: **public domain**, as recorded in the
  geoBoundaries metadata. geoBoundaries is credited for its standardized
  distribution; see its [API and licensing documentation](https://www.geoboundaries.org/api.html).
- Source year represented: **2018**. geoBoundaries build: December 12, 2023;
  pinned repository revision: `9469f09`.
- Country metadata: [USA ADM0](https://www.geoboundaries.org/api/current/gbOpen/USA/ADM0/),
  boundary ID `USA-ADM0-2327393`, source feature `2327393B34831548174820`.
- State metadata: [USA ADM1](https://www.geoboundaries.org/api/current/gbOpen/USA/ADM1/),
  boundary ID `USA-ADM1-66186276`.
- County metadata: [USA ADM2](https://www.geoboundaries.org/api/current/gbOpen/USA/ADM2/),
  boundary ID `USA-ADM2-52423323`.
- The selected Suffolk feature has source ID `52423323B97000000441045`;
  selection is verified against Boston's coordinates, avoiding the other
  US counties/cities named Suffolk.
- All **56 state/state-equivalent** and **3,233 county/county-equivalent**
  features in the source release are retained. These include its territorial
  coverage, not just the 50 states.
- The source ISO typo `SU-SD` is corrected to `US-SD` for South Dakota's internal
  feature ID; the original feature ID and name remain traceable.

## Files and schema

| File | Contents |
| --- | --- |
| `world.geojson` | 175 Natural Earth country features plus detailed geoBoundaries China/USA outlines |
| `regions-1.geojson` | Complete geoBoundaries China/US ADM1; 90 features |
| `regions-2.geojson` | Complete geoBoundaries China/US ADM2; 3,594 features |
| `first-background.geojson` | Other Natural Earth ADM1 regions; 4,459 features |
| `disputed.geojson` | Natural Earth breakaway/disputed/claim overlays; 99 features |
| `geography.js` | Merges `world`, `first`, and `disputed` into `window.trajectoryGeography` |
| `geography-regions-2.js` | Merges `second` into the same object |
| `geography-background.js` | Merges `firstBackground` into the same object |

The three scripts use `Object.assign` and can be loaded in any order or in
parallel. Wait for all three before resolving visit coordinates against every
available layer. The larger country/county data remains separate so the site
can load it only when the map is needed.

Every file uses GeoJSON longitude/latitude coordinates in decimal degrees.
Features carry `id`, `properties.id`, `properties.name`, `properties.country`
(two-letter ISO country code), and `properties.parent` (parent region ID).
Administrative features also retain `properties.sourceShapeId`. GeoBoundaries
second-level `parent` always identifies a feature in `first`; Natural Earth
background `parent` is its source country code. Disputed overlays intentionally
have `country: null` and `parent: null`.

| First-level ID | Second-level IDs |
| --- | --- |
| `CN-LN` | `CN-DL` |
| `CN-GD` | `CN-SZ`, `CN-GZ` |
| `CN-SD` | `CN-QD` |
| `US-MA` | `US-SUFFOLK` |

The sample IDs above remain stable. Other US first-level regions use source
ISO identifiers; other geoBoundaries IDs are derived from their `shapeID`
(`CN-ADM1-…`, `CN-ADM2-…`, `US-ADM2-…`). Natural Earth background IDs are
`NE-` plus the source `adm1_code`; disputed IDs are `NE-DISPUTED-` plus `NE_ID`.

## Preparation and verification

Install **Shapely 2.1.2** in a development environment, then run
`python3 scripts/prepare-geography.py` to rebuild from the pinned sources.
The browser does not need Python or Shapely. An optional `--cache-dir` allows
existing source files to be reused without network access.

The geoBoundaries administrative layers retain the source release's existing
simplification. Global Natural Earth ADM1 polygons use Shapely's
**shared-edge coverage simplification**, grouped by source country. Each of
the 241 country groups is verified as a valid edge-matched polygonal coverage
before simplification and again after coordinate quantization. The maximum
Visvalingam–Whyatt tolerance is **0.025 degrees**; countries containing small
urban administrative units use a lower tolerance, calculated from the smallest
region's area, with a minimum of 0.001 degrees. This preserves both shared
boundaries and detailed urban regions such as central London's Westminster.
Disputed polygons use topology-preserving **0.0035-degree** simplification.
The two detailed country backdrops use the earlier
0.0035-degree Ramer–Douglas–Peucker pass. No rectangular or invented boundaries
are substituted for source polygons.

All output features are validated as nonempty, valid polygonal geometries.
The one invalid polygon in the global ADM1 input is repaired before
simplification. Coordinates are quantized to four decimal places using
Shapely's valid-output precision model; very small features that would collapse
on this grid retain six decimal places. Unneeded properties are removed and
JSON is minified. Worldwide background ADM1 shared-edge topology is preserved
within each source country group. The output remains ordinary GeoJSON; shared
edges are duplicated in neighboring polygon features rather than encoded as
TopoJSON arcs.

Second-level parents are determined spatially. A representative interior point
resolves most features; where independently generalized coastal/island outlines
place that point outside a state, the parent with the largest positive polygon
intersection is used. No nearest-region guess is used. The builder checks that
all parent IDs exist, IDs are unique within each layer, and all coordinates are
within longitude/latitude bounds.

Lookup checks additionally cover Beijing, Shanghai, Hefei, New York,
Los Angeles, Cambridge (Massachusetts), London, Sydney, and Tokyo. The first six
resolve to both first- and second-level regions; the remaining cities resolve
to the worldwide first-level background, whose source does not provide a
second-level layer.

The script verifies valid longitude/latitude ranges and confirms that each
sample city center lies within both of its selected administrative regions and
the detailed country backdrop, after simplification and rounding:

| City | Longitude | Latitude |
| --- | ---: | ---: |
| Dalian | 121.6147 | 38.9140 |
| Shenzhen | 114.0579 | 22.5431 |
| Guangzhou | 113.2644 | 23.1291 |
| Qingdao | 120.3826 | 36.0671 |
| Boston | -71.0589 | 42.3601 |

These city-center coordinates locate the sample stays; they do not represent
street addresses. Administrative geometry represents the cited source years,
not a reconstruction of boundaries for every stay date.
