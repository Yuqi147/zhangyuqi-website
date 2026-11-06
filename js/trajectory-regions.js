/* Resolve CSV coordinates against real administrative polygons, never city names. */
(() => {
  'use strict';
  const EPSILON = 1e-9;
  const preparedGeometries = new WeakMap();
  const normalize = value => String(value || '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function prepareRing(coordinates) {
    const ring = [];
    coordinates.forEach(([longitude, latitude]) => {
      let x = longitude;
      if (ring.length) {
        const previous = ring[ring.length - 1][0];
        while (x - previous > 180) x -= 360;
        while (previous - x > 180) x += 360;
      }
      ring.push([x, latitude]);
    });
    return ring;
  }

  // 0 = outside, 1 = interior, 2 = boundary. Longitudes are unwrapped so
  // a polygon crossing ±180° does not accidentally include most of the world.
  function ringRelation(ring, [longitude, y]) {
    if (ring.length < 3) return 0;
    const x = longitude + 360 * Math.round((ring[0][0] - longitude) / 360);
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
      const tolerance = EPSILON * Math.max(1, Math.abs(bx - ax), Math.abs(by - ay));
      if (Math.abs(cross) <= tolerance &&
          x >= Math.min(ax, bx) - EPSILON && x <= Math.max(ax, bx) + EPSILON &&
          y >= Math.min(ay, by) - EPSILON && y <= Math.max(ay, by) + EPSILON) return 2;
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside ? 1 : 0;
  }

  function contains(geometry, point) {
    if (!geometry || !Array.isArray(point) || point.length < 2 ||
        !point.every(Number.isFinite)) return false;
    if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) return false;
    let polygons = preparedGeometries.get(geometry);
    if (!polygons) {
      const source = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      polygons = source.map(polygon => polygon.map(prepareRing));
      preparedGeometries.set(geometry, polygons);
    }
    return polygons.some(polygon => {
      if (!polygon.length) return false;
      const outer = ringRelation(polygon[0], point);
      if (!outer) return false;
      if (outer === 2) return true;
      for (const hole of polygon.slice(1)) {
        const relation = ringRelation(hole, point);
        if (relation === 2) return true;
        if (relation === 1) return false;
      }
      return true;
    });
  }

  function withinBounds(bbox, [longitude, latitude]) {
    if (!bbox || bbox.length !== 4) return true;
    const [west, south, east, north] = bbox;
    if (latitude < south - EPSILON || latitude > north + EPSILON) return false;
    if (west > east) return longitude >= west - EPSILON || longitude <= east + EPSILON;
    return [longitude, longitude - 360, longitude + 360]
      .some(x => x >= west - EPSILON && x <= east + EPSILON);
  }

  function countryLookup(geography, features) {
    const aliases = new Map();
    const add = (name, code) => { if (name && code) aliases.set(normalize(name), code); };
    const codes = new Set(features.map(feature => feature.properties.country).filter(Boolean));
    const displayNames = typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    codes.forEach(code => {
      add(code, code);
      if (displayNames && /^[A-Z]{2}$/.test(code)) add(displayNames.of(code), code);
    });
    (geography.world?.features || []).forEach(feature => {
      const { country, name } = feature.properties;
      add(country, country);
      add(name, country);
    });
    // Familiar alternative country names are aliases, not location lookups.
    ['United States', 'United States of America', 'USA', 'US'].forEach(name => add(name, 'US'));
    ['China', 'People’s Republic of China', "People's Republic of China", 'PRC', 'CHN', 'CN'].forEach(name => add(name, 'CN'));
    return aliases;
  }

  function resolveStays(stays, geography) {
    // Detailed administrative sources take precedence over the global backdrop.
    const first = [...(geography.first?.features || [])];
    const firstIds = new Set(first.map(feature => feature.properties.id));
    (geography.firstBackground?.features || []).forEach(feature => {
      if (!firstIds.has(feature.properties.id)) {
        first.push(feature);
        firstIds.add(feature.properties.id);
      }
    });
    const second = geography.second?.features || [];
    const countries = countryLookup(geography, [...first, ...second]);
    const byId = features => new Map(features.map(feature => [feature.properties.id, feature]));
    const indexes = { first: byId(first), second: byId(second) };
    const warnings = [];

    const resolved = stays.map(source => {
      const stay = { ...source };
      delete stay.region1;
      delete stay.region2;
      const point = [source.longitude, source.latitude];
      const country = countries.get(normalize(source.country));
      const city = source.city || source.id || 'This stay';
      const countryMatches = feature => !!country && feature.properties.country === country;
      const encloses = feature => withinBounds(feature.bbox, point) && contains(feature.geometry, point);
      const choose = (features, level, explicitId, parent) => {
        const eligible = feature => countryMatches(feature) &&
          (!parent || !feature.properties.parent || feature.properties.parent === parent);
        if (explicitId) {
          const explicit = indexes[level].get(explicitId);
          if (explicit && eligible(explicit) && encloses(explicit)) return explicit;
          warnings.push(`${city}: ${level === 'first' ? 'region1' : 'region2'} "${explicitId}" does not match an available outline at these coordinates; checked the coordinates instead.`);
        }
        const matches = features.filter(feature => eligible(feature) && encloses(feature));
        if (level === 'first' && matches.length > 1) {
          return matches.find(feature => normalize(feature.properties.name) === normalize(source.region)) || matches[0];
        }
        return matches[0];
      };

      let parent = choose(first, 'first', source.region1);
      const child = choose(second, 'second', source.region2, parent?.properties.id);
      // A recorded parent relationship can bridge tiny coast/border differences
      // between simplified administrative layers; no nearest-region guess is used.
      if (!parent && child?.properties.parent) {
        const candidate = indexes.first.get(child.properties.parent);
        if (candidate && countryMatches(candidate)) parent = candidate;
      }
      if (parent) stay.region1 = parent.properties.id;
      else warnings.push(`${city}: first-level administrative outline is unavailable for these coordinates.`);
      if (child) stay.region2 = child.properties.id;
      else warnings.push(`${city}: second-level administrative outline is unavailable for these coordinates.`);
      return stay;
    });
    return { stays: resolved, warnings };
  }

  globalThis.LifeTrajectoryRegions = { contains, resolveStays };
})();
