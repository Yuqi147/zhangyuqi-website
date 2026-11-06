#!/usr/bin/env python3
"""Build local trajectory-map datasets from pinned, attributed open sources.

Build dependency: Shapely 2.1.2 (pip install shapely==2.1.2). The website has no
Python dependency. Network is needed unless --cache-dir has the source files.
"""

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

from shapely import STRtree, coverage_is_valid, coverage_simplify, make_valid, set_precision
from shapely.geometry import mapping, shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets' / 'geography'
GB_BASE = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData'
SOURCES = {
    'world': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_110m_admin_0_countries.geojson',
    'gbHumanitarian-CHN-ADM0': f'{GB_BASE}/gbHumanitarian/CHN/ADM0/geoBoundaries-CHN-ADM0_simplified.geojson',
    'gbOpen-USA-ADM0': f'{GB_BASE}/gbOpen/USA/ADM0/geoBoundaries-USA-ADM0_simplified.geojson',
    'CHN-ADM1': f'{GB_BASE}/gbHumanitarian/CHN/ADM1/geoBoundaries-CHN-ADM1_simplified.geojson',
    'gbHumanitarian-CHN-ADM2': f'{GB_BASE}/gbHumanitarian/CHN/ADM2/geoBoundaries-CHN-ADM2_simplified.geojson',
    'gbOpen-USA-ADM1': f'{GB_BASE}/gbOpen/USA/ADM1/geoBoundaries-USA-ADM1_simplified.geojson',
    'gbOpen-USA-ADM2': f'{GB_BASE}/gbOpen/USA/ADM2/geoBoundaries-USA-ADM2_simplified.geojson',
    'ne-disputed': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_disputed_areas.geojson',
    'ne-first': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_1_states_provinces.geojson',
}


def read_source(key, cache_dir):
    cache = cache_dir / f'{key}.geojson' if cache_dir else None
    if cache and cache.exists():
        return json.loads(cache.read_text())
    with urlopen(SOURCES[key], timeout=60) as response:
        return json.load(response)


def rounded(value, digits=4):
    if isinstance(value, (list, tuple)):
        return [rounded(item, digits) for item in value]
    return round(value, digits)


def coordinate_pairs(value):
    if isinstance(value[0], (int, float)):
        yield value
    else:
        for item in value:
            yield from coordinate_pairs(item)


def simplify_ring(ring, tolerance=0.0035):
    """Ramer-Douglas-Peucker simplification for country-backdrop rings only.

    A 0.0035-degree simplification tolerance retains detailed coastlines while
    keeping the locally loaded bundle small. Retain small islands, closed rings,
    and winding; administrative highlight geometry is untouched.
    """
    keep = {0, len(ring) - 1}
    stack = [(0, len(ring) - 1)]
    while stack:
        first, last = stack.pop()
        a, b = ring[first], ring[last]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length_squared = dx * dx + dy * dy
        greatest = tolerance * tolerance
        split = None
        for index in range(first + 1, last):
            point = ring[index]
            fraction = (0 if length_squared == 0 else max(0, min(1,
                        ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length_squared)))
            distance_squared = ((point[0] - a[0] - fraction * dx) ** 2
                                + (point[1] - a[1] - fraction * dy) ** 2)
            if distance_squared > greatest:
                greatest, split = distance_squared, index
        if split is not None:
            keep.add(split)
            stack.extend([(first, split), (split, last)])
    result = [ring[index] for index in sorted(keep)]
    def signed_area(points):
        return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:]))
    if len(result) < 4 or signed_area(result) * signed_area(ring) <= 0:
        return ring
    return result


def detailed_country(source):
    geometry = source['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    coordinates = [[simplify_ring(ring) for ring in polygon] for polygon in polygons]
    return {**source, 'geometry': {'type': geometry['type'], 'coordinates':
            coordinates if geometry['type'] == 'MultiPolygon' else coordinates[0]}}


def ring_contains(ring, point):
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:]):
        if ((a[1] > y) != (b[1] > y)
                and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]):
            inside = not inside
    return inside


def contains(geometry, point):
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    return any(ring_contains(polygon[0], point)
               and not any(ring_contains(hole, point) for hole in polygon[1:])
               for polygon in polygons)


def polygonal(geometry):
    if geometry.geom_type in ('Polygon', 'MultiPolygon'):
        return geometry
    if geometry.geom_type == 'GeometryCollection':
        pieces = [polygonal(part) for part in geometry.geoms
                  if part.geom_type in ('Polygon', 'MultiPolygon', 'GeometryCollection')]
        return unary_union(pieces)
    raise ValueError(f'Expected polygonal geometry; got {geometry.geom_type}')


def encoded_geometry(raw, tolerance=None):
    geometry = shape(raw)
    if not geometry.is_valid:
        geometry = polygonal(make_valid(geometry))
    if tolerance:
        geometry = geometry.simplify(tolerance, preserve_topology=True)
    precise = set_precision(geometry, 0.0001, mode='valid_output')
    # Keep tiny disputed islands rather than collapsing them onto the rounding grid.
    digits = 4
    if precise.is_empty:
        precise, digits = geometry, 6
    result = mapping(precise)
    encoded = {'type': result['type'], 'coordinates': rounded(result['coordinates'], digits)}
    assert not shape(encoded).is_empty and shape(encoded).is_valid
    return encoded


def feature(source, identifier, name, country, parent, *, tolerance=None, extra=None):
    geometry = encoded_geometry(source['geometry'], tolerance)
    points = list(coordinate_pairs(geometry['coordinates']))
    assert all(-180 <= x <= 180 and -90 <= y <= 90 for x, y in points)
    props = {'id': identifier, 'name': name, 'country': country, 'parent': parent}
    if 'shapeID' in source['properties']:
        props['sourceShapeId'] = source['properties']['shapeID']
    if extra:
        props.update(extra)
    return {'type': 'Feature', 'id': identifier, 'properties': props,
            'bbox': [min(p[0] for p in points), min(p[1] for p in points),
                     max(p[0] for p in points), max(p[1] for p in points)],
            'geometry': geometry}


def named(collection, name, point=None):
    candidates = [f for f in collection['features'] if f['properties']['shapeName'] == name]
    if point:
        candidates = [f for f in candidates if contains(f['geometry'], point)]
    assert len(candidates) == 1, (name, len(candidates))
    return candidates[0]


def collection(features):
    return {'type': 'FeatureCollection', 'features': features}


def parent_index(first):
    geometries = [shape(f['geometry']) for f in first]
    return STRtree(geometries), geometries


def parent_for(source, first, tree, geometries):
    child = shape(source['geometry'])
    point = child.representative_point()
    candidates = [int(index) for index in tree.query(point)
                  if geometries[int(index)].covers(point)]
    if len(candidates) == 1:
        return first[candidates[0]]['id']
    # Generalized coastal/island polygons may have an interior point just beyond
    # the independently simplified parent. Resolve by real overlap, never by name
    # guessing or nearest-state distance.
    overlaps = [(child.intersection(geometries[int(index)]).area, int(index))
                for index in tree.query(child)]
    assert overlaps and max(overlaps)[0] > 0, source['properties']
    return first[max(overlaps)[1]]['id']


def write_collection(filename, data):
    (OUTPUT / filename).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')


def write_bundle(filename, values):
    payload = json.dumps(values, ensure_ascii=False, separators=(',', ':'))
    (OUTPUT / filename).write_text(
        '// Generated by scripts/prepare-geography.py. Licenses: assets/geography/SOURCES.md.\n'
        + 'Object.assign(window.trajectoryGeography = window.trajectoryGeography || {}, '
        + payload + ');\n')
    print(f'{filename}: {(OUTPUT / filename).stat().st_size:,} bytes')


def build(cache_dir=None):
    sources = {key: read_source(key, cache_dir) for key in SOURCES}
    detailed = {
        'CHN': detailed_country(sources['gbHumanitarian-CHN-ADM0']['features'][0]),
        'USA': detailed_country(sources['gbOpen-USA-ADM0']['features'][0]),
    }
    world = collection([
        feature(detailed.get(f['properties']['ADM0_A3'], f),
                f['properties']['ADM0_A3'], f['properties']['NAME_EN'],
                f['properties']['ISO_A2_EH'], None)
        for f in sources['world']['features']
    ])
    province_aliases = {
        'Liaoning Province': ('CN-LN', 'Liaoning'),
        'Guangdong Province': ('CN-GD', 'Guangdong'),
        'Shandong Province': ('CN-SD', 'Shandong'),
    }
    first_by_country = {'CN': [], 'US': []}
    for country, key in [('CN', 'CHN-ADM1'), ('US', 'gbOpen-USA-ADM1')]:
        for source in sources[key]['features']:
            props = source['properties']
            name = props['shapeName']
            identifier = f"{country}-ADM1-{props['shapeID']}"
            if country == 'US':
                # Correct the source's transposed South Dakota ISO prefix.
                identifier = 'US-SD' if props['shapeISO'] == 'SU-SD' else props['shapeISO']
            elif name in province_aliases:
                identifier, name = province_aliases[name]
            first_by_country[country].append(feature(
                source, identifier, name, country, country,
                extra={'sourceName': props['shapeName'], 'sourceCountry': props['shapeGroup']}))
    first = collection(first_by_country['CN'] + first_by_country['US'])
    cities = [
        ('Dalian', 'CN-DL', 'CN-LN', (121.6147, 38.9140)),
        ('Shenzhen', 'CN-SZ', 'CN-GD', (114.0579, 22.5431)),
        ('Guangzhou', 'CN-GZ', 'CN-GD', (113.2644, 23.1291)),
        ('Qingdao', 'CN-QD', 'CN-SD', (120.3826, 36.0671)),
    ]
    city_aliases = {name: identifier for name, identifier, _, _ in cities}
    second = collection([])
    for country, key in [('CN', 'gbHumanitarian-CHN-ADM2'), ('US', 'gbOpen-USA-ADM2')]:
        parents = first_by_country[country]
        tree, geometries = parent_index(parents)
        for source in sources[key]['features']:
            props = source['properties']
            name = props['shapeName']
            identifier = f"{country}-ADM2-{props['shapeID']}"
            if country == 'CN' and name in city_aliases:
                identifier = city_aliases[name]
            if props['shapeID'] == '52423323B97000000441045':
                identifier, name = 'US-SUFFOLK', 'Suffolk County'
            parent = parent_for(source, parents, tree, geometries)
            second['features'].append(feature(source, identifier, name, country, parent))
    boston = (-71.0589, 42.3601)

    # Do not duplicate the CN/US release coverage with a different background
    # source, including its separately coded islands and territories.
    covered = {'CHN', 'HKG', 'MAC', 'TWN', 'USA', 'PRI', 'GUM', 'VIR', 'ASM', 'MNP'}
    first_background = collection([])
    background_groups = defaultdict(list)
    for source in sources['ne-first']['features']:
        props = source['properties']
        if props['adm0_a3'] in covered:
            continue
        background_groups[props['adm0_a3']].append(source)
    for country_group, group in background_groups.items():
        geometries = [shape(source['geometry']) for source in group]
        geometries = [g if g.is_valid else polygonal(make_valid(g)) for g in geometries]
        assert coverage_is_valid(geometries), country_group
        # Treat shared edges together so simplification cannot create gaps
        # between adjoining administrative regions. Small urban regions (e.g.
        # London boroughs) lower the tolerance for their entire country group.
        tolerance = min(0.025, max(0.001, math.sqrt(min(g.area for g in geometries)) * 0.12))
        simplified = coverage_simplify(geometries, tolerance, simplify_boundary=True)
        assert coverage_is_valid(simplified), country_group
        group_features = []
        for source, geometry in zip(group, simplified):
            props = source['properties']
            identifier = 'NE-' + props['adm1_code']
            adjusted = {**source, 'geometry': mapping(geometry)}
            group_features.append(feature(
                adjusted, identifier, props.get('name_en') or props.get('name') or props['adm1_code'],
                props['iso_a2'], props['iso_a2'],
                extra={'sourceId': props['adm1_code'], 'source': 'Natural Earth',
                       'iso3166_2': props['iso_3166_2'], 'countryName': props['admin']}))
        assert coverage_is_valid([shape(f['geometry']) for f in group_features]), country_group
        first_background['features'].extend(group_features)

    disputed = collection([])
    for source in sources['ne-disputed']['features']:
        props = source['properties']
        disputed['features'].append(feature(
            source, 'NE-DISPUTED-' + str(props['NE_ID']),
            props['BRK_NAME'] or props['NAME_LONG'] or props['NAME'], None, None,
            tolerance=0.0035,
            extra={'claims': props.get('NOTE_BRK'), 'featureClass': props['featurecla'],
                   'sourceId': str(props['NE_ID']), 'source': 'Natural Earth',
                   'sourceName': props['NAME'], 'sourceAdmin': props.get('ADMIN'),
                   'sourceType': props.get('TYPE'), 'sourceBreakawayCode': props.get('BRK_A3')}))

    by_id = {f['id']: f for f in first['features'] + second['features']}
    country_by_id = {f['id']: f for f in world['features']}
    for name, identifier, parent, point in cities + [('Boston', 'US-SUFFOLK', 'US-MA', boston)]:
        assert contains(by_id[identifier]['geometry'], point), f'{name}: point outside second-level boundary'
        assert contains(by_id[parent]['geometry'], point), f'{name}: point outside first-level boundary'
        assert by_id[identifier]['properties']['parent'] == parent
        country = 'USA' if identifier.startswith('US-') else 'CHN'
        assert contains(country_by_id[country]['geometry'], point), f'{name}: point outside country backdrop'
        print(f'{name}: longitude/latitude lies within both administrative levels and country backdrop.')

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for filename, data in [('world.geojson', world), ('regions-1.geojson', first),
                           ('regions-2.geojson', second), ('first-background.geojson', first_background),
                           ('disputed.geojson', disputed)]:
        assert len({f['id'] for f in data['features']}) == len(data['features']), filename
        write_collection(filename, data)
        print(f'{filename}: {len(data["features"]):,} features')
    assert all(f['properties']['parent'] in by_id for f in second['features'])
    write_bundle('geography.js', {'world': world, 'first': first, 'disputed': disputed})
    write_bundle('geography-regions-2.js', {'second': second})
    write_bundle('geography-background.js', {'firstBackground': first_background})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, help='Optional source GeoJSON cache directory')
    build(parser.parse_args().cache_dir)
