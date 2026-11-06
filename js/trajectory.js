/* CSV is the single source of stay records; geometry is bundled separately. */
document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('life-trajectory');
  if (!section || !window.LifeTrajectoryData || !window.LifeTrajectoryRegions) return;

  const { categories, gridSize, parseCSV, groupStays, toCSV } = window.LifeTrajectoryData;
  const { resolveStays } = window.LifeTrajectoryRegions;
  const mapElement = document.getElementById('trajectoryMap');
  const loading = document.getElementById('trajectoryMapLoading');
  const loadingText = document.getElementById('trajectoryMapLoadingText');
  const retry = document.getElementById('trajectoryMapRetry');
  const description = document.getElementById('trajectoryMapDescription');
  const selection = document.getElementById('trajectorySelection');
  const rows = document.getElementById('trajectoryRows');
  const download = document.getElementById('trajectoryDownload');
  const dataStatus = document.getElementById('trajectoryDataStatus');
  const dataRetry = document.getElementById('trajectoryDataRetry');
  const toggles = [...section.querySelectorAll('[data-map-level]')];
  const areas = [...section.querySelectorAll('[data-map-area]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const levels = ['first', 'second', 'precise'];
  const enabled = new Set(['first']);
  const names = { first: 'First-level regions', second: 'Second-level regions', precise: 'Precise locations' };
  const scriptLoads = new Map();
  const featureIndexes = {};
  const boundaryLayers = {};
  const fillLayers = {};
  const currentLayers = new Map();
  let records = [];
  let stays = [];
  let dataLoaded = false;
  let dataPromise;
  let map;
  let initializing;
  let pendingInitialFit = false;
  let currentGroups = [];

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function purposeBadge(purpose, label = categories[purpose].label) {
    const badge = element('span', undefined, `trajectory-purpose purpose-${purpose}`);
    const swatch = element('span', undefined, 'trajectory-swatch');
    swatch.setAttribute('aria-hidden', 'true');
    badge.append(swatch, document.createTextNode(label));
    return badge;
  }

  const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  function dateLabel(value) {
    if (!value) return 'Present';
    return value.length === 7 ? monthFormat.format(new Date(value + '-01T00:00:00Z')) : value;
  }

  function dateElement(value) {
    const node = element(value ? 'time' : 'span', dateLabel(value), 'trajectory-date');
    if (value) node.setAttribute('datetime', value);
    return node;
  }

  function placeName(stay, field) {
    const isChina = /^(china|cn|chn|prc|people['’]s republic of china)$/i.test(stay.country.trim());
    const chinese = stay[field === 'city' ? 'cityZh' : 'regionZh'];
    return isChina && chinese ? `${stay[field]} (${chinese})` : stay[field];
  }

  function renderTable() {
    rows.replaceChildren();
    records.forEach(stay => {
      const row = element('tr');
      row.dataset.stay = stay.id;
      const cityCell = element('td');
      const cityButton = element('button', placeName(stay, 'city'), 'trajectory-city');
      cityButton.type = 'button';
      cityButton.setAttribute('aria-label', `Show ${placeName(stay, 'city')} on map`);
      cityButton.addEventListener('click', async () => {
        if (!await initializeMap()) return;
        // Prefer the most detailed enabled layer without changing the checkboxes.
        const group = [...currentGroups].reverse().find(item => item.stays.some(entry => entry.id === stay.id));
        if (group) selectGroup(group, { zoom: true });
        else showStay(stay);
        mapElement.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      });
      cityCell.append(cityButton);
      row.append(cityCell, element('td', placeName(stay, 'region')), element('td', stay.country));
      const purpose = element('td');
      purpose.append(purposeBadge(stay.purpose, stay.purposeLabel));
      const start = element('td');
      start.append(dateElement(stay.start));
      const end = element('td');
      end.append(dateElement(stay.end));
      row.append(purpose, start, end);
      rows.append(row);
    });
    document.getElementById('trajectoryStats').textContent =
      `${new Set(records.map(stay => `${stay.country}/${stay.region}/${stay.city}`)).size} places · ${new Set(records.map(stay => `${stay.country}/${stay.region}`)).size} regions · ${new Set(records.map(stay => stay.country)).size} countries`;
  }

  async function loadData() {
    if (dataLoaded) return records;
    if (dataPromise) return dataPromise;
    dataRetry.hidden = true;
    dataStatus.hidden = false;
    dataStatus.textContent = 'Loading the stay log…';
    dataPromise = (async () => {
      try {
        const response = await fetch('data/life-trajectory.csv', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Unable to read the stay CSV (HTTP ${response.status}).`);
        records = parseCSV(await response.text());
        dataLoaded = true;
        renderTable();
        download.disabled = false;
        dataStatus.textContent = records.length ? '' : 'No stays have been added yet.';
        dataStatus.hidden = records.length > 0;
        return records;
      } catch (error) {
        dataStatus.textContent = `The stay log could not load. ${error.message}`;
        dataStatus.hidden = false;
        dataRetry.hidden = false;
        throw error;
      } finally {
        dataPromise = null;
      }
    })();
    return dataPromise;
  }

  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF', toCSV(records)], { type: 'text/csv;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = 'life-trajectory.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    if (scriptLoads.has(src)) return scriptLoads.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => ready() ? resolve() : reject(new Error(`Invalid map asset: ${src}`));
      script.onerror = () => { script.remove(); reject(new Error(`Unable to load map asset: ${src}`)); };
      document.head.append(script);
    }).catch(error => { scriptLoads.delete(src); throw error; });
    scriptLoads.set(src, promise);
    return promise;
  }

  function groupTitle(group) {
    if (group.level === 'precise') return [...new Set(group.stays.map(stay => placeName(stay, 'city')))].join(' / ');
    const { name, country } = featureIndexes[group.level].get(group.id).properties;
    if (country !== 'CN') return name;
    const field = group.level === 'first' ? 'region' : 'city';
    const normalize = value => value.toLowerCase().replace(/\s+(province|municipality|city|uygur autonomous region|special administrative region)$/i, '').trim();
    const stay = group.stays.find(item => normalize(item[field]) === normalize(name) && item[field === 'city' ? 'cityZh' : 'regionZh']);
    return stay ? `${name} (${stay[field === 'city' ? 'cityZh' : 'regionZh']})` : name;
  }

  function popupFor(group) {
    const content = element('div');
    content.append(element('strong', groupTitle(group)), purposeBadge(group.purpose));
    group.stays.forEach(stay => content.append(element('p', `${placeName(stay, 'city')} · ${stay.purposeLabel || categories[stay.purpose].label}\n${dateLabel(stay.start)} — ${dateLabel(stay.end)}`)));
    if (group.cell) {
      const { west, south, east, north } = group.cell;
      content.append(element('p', `Longitude ${west}° to ${east}° · Latitude ${south}° to ${north}°`));
    }
    return content;
  }

  function selectRows(ids) {
    rows.querySelectorAll('tr').forEach(row => row.classList.toggle('is-selected', ids.includes(row.dataset.stay)));
  }

  function selectGroup(group, { zoom = false, point } = {}) {
    const layer = currentLayers.get(`${group.level}:${group.id}`);
    selectRows(group.stays.map(stay => stay.id));
    selection.replaceChildren(element('strong', `${groupTitle(group)} · ${categories[group.purpose].label}`));
    selection.append(document.createTextNode(' — ' + group.stays.map(stay => `${placeName(stay, 'city')}: ${dateLabel(stay.start)} to ${dateLabel(stay.end)} (${stay.purposeLabel || categories[stay.purpose].label})`).join('; ')));
    if (zoom) map.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: group.level === 'precise' ? 8 : 7, animate: false });
    window.L.popup({ maxWidth: 280, maxHeight: 220, autoPan: false })
      .setLatLng(point || [group.stays[0].latitude, group.stays[0].longitude])
      .setContent(popupFor(group)).openOn(map);
  }

  function showStay(stay) {
    selectRows([stay.id]);
    selection.textContent = `${placeName(stay, 'city')} · ${stay.purposeLabel || categories[stay.purpose].label} — ${dateLabel(stay.start)} to ${dateLabel(stay.end)}`;
    const content = element('div');
    content.append(element('strong', `${placeName(stay, 'city')}, ${placeName(stay, 'region')}`), purposeBadge(stay.purpose, stay.purposeLabel), element('p', `${dateLabel(stay.start)} — ${dateLabel(stay.end)}`));
    map.setView([stay.latitude, stay.longitude], 6, { animate: false });
    window.L.popup({ autoPan: false }).setLatLng([stay.latitude, stay.longitude]).setContent(content).openOn(map);
  }

  function fillColor(color) {
    // Opaque muted fills keep the top layer's color independent of layers below.
    const background = [10, 18, 32];
    const rgb = [1, 3, 5].map((offset, i) => Math.round(parseInt(color.slice(offset, offset + 2), 16) * 0.68 + background[i] * 0.32));
    return `rgb(${rgb.join(',')})`;
  }

  function makeAccessible(layer, label, activate) {
    const paths = layer.getLayers ? layer.getLayers() : [layer];
    paths.forEach(path => {
      const node = path.getElement();
      if (!node) return;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', label);
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
      });
    });
  }

  function renderLayers() {
    const L = window.L;
    toggles.forEach(toggle => { toggle.checked = enabled.has(toggle.dataset.mapLevel); });
    map.closePopup();
    currentLayers.clear();
    currentGroups = [];
    selectRows([]);
    selection.textContent = 'Select a region or a city in the table to explore a stay.';
    mapElement.dataset.layers = levels.filter(level => enabled.has(level)).join(' ');
    description.textContent = enabled.size
      ? `${levels.filter(level => enabled.has(level)).map(level => names[level]).join(' + ')}. Smaller areas appear on top.`
      : 'Background map only. Select a layer to show your stays.';

    levels.forEach(level => {
      fillLayers[level].clearLayers();
      const showBoundary = enabled.has(level) || enabled.has('precise')
        || (level === 'first' && enabled.has('second'));
      if (boundaryLayers[level]) {
        if (showBoundary) boundaryLayers[level].addTo(map);
        else map.removeLayer(boundaryLayers[level]);
      }
      const legend = section.querySelector(`[data-boundary-legend="${level}"]`);
      if (legend) legend.classList.toggle('is-inactive', !showBoundary);
      if (!enabled.has(level)) return;
      groupStays(stays, level).forEach(item => {
        const group = { ...item, level };
        const feature = level === 'precise' ? null : featureIndexes[level].get(group.id);
        if (level !== 'precise' && !feature) return;
        const color = categories[group.purpose].color;
        const style = { color, weight: 1.1, opacity: 1, fillColor: fillColor(color), fillOpacity: 1, pane: `atlas-fill-${level}` };
        const layer = level === 'precise'
          ? L.rectangle([[group.cell.south, group.cell.west], [group.cell.north, group.cell.east]], style)
          : L.geoJSON(feature, { style });
        layer.addTo(fillLayers[level]);
        currentLayers.set(`${level}:${group.id}`, layer);
        currentGroups.push(group);
        const label = `${groupTitle(group)} · ${categories[group.purpose].label} · ${names[level]}`;
        layer.bindTooltip(label, { sticky: true, direction: 'top' });
        layer.on('click', event => selectGroup(group, { point: event.latlng }));
        makeAccessible(layer, `Explore ${label}`, () => selectGroup(group, { zoom: true }));
      });
    });
  }

  function showArea(area) {
    map.closePopup();
    const bounds = area === 'china' ? [[18, 73], [54, 135]]
      : area === 'us' ? [[24, -125], [50, -66]]
      : area === 'europe' ? [[34, -12], [71, 40]]
      : [[-55, -180], [78, 180]];
    map.fitBounds(bounds, { padding: [20, 20], animate: false });
  }

  function addBackground(geography) {
    const L = window.L;
    const allFirst = [...geography.firstBackground.features, ...geography.first.features];
    featureIndexes.first = new Map(allFirst.map(feature => [feature.properties.id, feature]));
    featureIndexes.second = new Map(geography.second.features.map(feature => [feature.properties.id, feature]));
    const collection = features => ({ type: 'FeatureCollection', features });
    const background = (data, pane, style) => L.geoJSON(data, {
      renderer: L.canvas({ pane, padding: 0.2 }), interactive: false, style,
    });
    background(geography.world, 'atlas-land', { stroke: false, fillColor: '#19273c', fillOpacity: 1 }).addTo(map);
    background(geography.world, 'atlas-country', { fill: false, color: '#a3b1c8', weight: 1.4, opacity: 0.46 }).addTo(map);
    boundaryLayers.first = background(collection(allFirst), 'atlas-boundary-first', { fill: false, color: '#a3b1c8', weight: 0.8, opacity: 0.46 });
    boundaryLayers.second = background(geography.second, 'atlas-boundary-second', { fill: false, color: '#aabedc', weight: 0.6, opacity: 0.24 });
    const disputed = L.geoJSON(geography.disputed, {
      pane: 'atlas-disputed',
      style: { fill: false, color: '#a3b1c8', weight: 1, opacity: 1, dashArray: '6 4' },
      onEachFeature(feature, layer) {
        const { name, claims, featureClass } = feature.properties;
        const detail = element('div');
        detail.append(element('strong', name || 'Disputed area'));
        if (claims) detail.append(element('p', claims));
        else if (featureClass) detail.append(element('p', featureClass));
        detail.append(element('p', 'Source: Natural Earth disputed-area dataset.'));
        layer.bindTooltip(detail, { sticky: true, direction: 'top' });
        layer.bindPopup(detail.cloneNode(true), { maxWidth: 300, autoPan: false });
      },
    }).addTo(map);
    disputed.eachLayer(layer => {
      const label = `Disputed area: ${layer.feature.properties.name || 'Unnamed area'}`;
      makeAccessible(layer, label, () => layer.openPopup(layer.getBounds().getCenter()));
    });
    // Noninteractive canvas borders must not intercept clicks on colored shapes.
    ['atlas-land', 'atlas-country', 'atlas-boundary-first', 'atlas-boundary-second'].forEach(pane => {
      map.getPane(pane).style.pointerEvents = 'none';
    });
  }

  async function initializeMap() {
    if (map) return true;
    if (initializing) return initializing;
    loading.hidden = false;
    retry.hidden = true;
    loadingText.textContent = 'Loading the map…';
    initializing = (async () => {
      try {
        await Promise.all([
          loadData(),
          loadScript('assets/vendor/leaflet/leaflet.js', () => !!window.L),
          loadScript('assets/geography/geography.js', () => !!window.trajectoryGeography?.disputed),
          loadScript('assets/geography/geography-regions-2.js', () => !!window.trajectoryGeography?.second),
          loadScript('assets/geography/geography-background.js', () => !!window.trajectoryGeography?.firstBackground),
        ]);
        const geography = window.trajectoryGeography;
        stays = resolveStays(records, geography).stays;
        const L = window.L;
        map = L.map(mapElement, {
          minZoom: 0, maxZoom: 10, zoomSnap: 0.25, scrollWheelZoom: true,
          wheelPxPerZoomLevel: 14, wheelDebounceTime: 16,
          zoomAnimation: false, fadeAnimation: !reducedMotion.matches,
          maxBounds: [[-85, -220], [85, 220]], maxBoundsViscosity: 1,
        });
        [
          ['atlas-land', 200], ['atlas-fill-first', 300], ['atlas-fill-second', 320],
          ['atlas-fill-precise', 340], ['atlas-boundary-first', 420],
          ['atlas-boundary-second', 430], ['atlas-country', 440], ['atlas-disputed', 500],
        ].forEach(([name, zIndex]) => { map.createPane(name).style.zIndex = zIndex; });
        pendingInitialFit = !mapElement.clientWidth || !mapElement.clientHeight;
        if (pendingInitialFit) map.setView([20, 0], 1, { animate: false });
        else showArea('world');
        addBackground(geography);
        levels.forEach(level => { fillLayers[level] = L.featureGroup().addTo(map); });
        map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
        map.attributionControl.addAttribution('Natural Earth · geoBoundaries');
        renderLayers();
        const resize = new ResizeObserver(() => {
          if (mapElement.clientWidth && mapElement.clientHeight) {
            map.invalidateSize({ pan: false });
            if (pendingInitialFit) { pendingInitialFit = false; showArea('world'); }
          }
        });
        resize.observe(mapElement);
        [...toggles, ...areas].forEach(control => { control.disabled = false; });
        loading.hidden = true;
        return true;
      } catch (error) {
        if (map) { map.remove(); map = null; }
        loadingText.textContent = dataLoaded
          ? 'The map could not load. Your stay log and CSV are available below.'
          : 'The map needs the stay log. Check the CSV loading message below, then try again.';
        retry.hidden = false;
        console.error('Life trajectory:', error);
        return false;
      } finally {
        initializing = null;
      }
    })();
    return initializing;
  }

  toggles.forEach(toggle => toggle.addEventListener('change', () => {
    if (toggle.checked) enabled.add(toggle.dataset.mapLevel);
    else enabled.delete(toggle.dataset.mapLevel);
    renderLayers();
  }));
  areas.forEach(button => button.addEventListener('click', () => showArea(button.dataset.mapArea)));
  retry.addEventListener('click', initializeMap);
  dataRetry.addEventListener('click', () => initializeMap());
  loadData().catch(() => {}); // The visible stay-log status reports CSV errors.
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { initializeMap(); observer.disconnect(); }
  }, { rootMargin: '300px' });
  observer.observe(section);
});
