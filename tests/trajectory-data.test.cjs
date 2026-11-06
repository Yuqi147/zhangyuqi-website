// Run with: node tests/trajectory-data.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../js/trajectory-data.js');
const { categories, gridSize, parseCSV, groupStays, cellFor, toCSV } = globalThis.LifeTrajectoryData;
const journal = parseCSV(fs.readFileSync(path.join(__dirname, '../data/life-trajectory.csv'), 'utf8'));
assert.deepEqual(parseCSV(toCSV(journal)), journal, 'The editable journal round-trips through the CSV exporter');
// Use a fixed example for aggregation and parser tests as the real journal grows.
const source = `id,city,state_province,country,purpose,start,end,longitude,latitude,city_zh,state_province_zh
dalian,Dalian,Liaoning,China,study,2004-02-22,2022-08-14,121.6147,38.914,大连,辽宁
shenzhen,Shenzhen,Guangdong,China,study,2022-08-14,2026-07-02,114.0579,22.5431,深圳,广东
guangzhou,Guangzhou,Guangdong,China,live,2024-05-01,2024-05-07,113.2644,23.1291,广州,广东
qingdao,Qingdao,Shandong,China,travel,2026-05-20,2026-05-25,120.3826,36.0671,青岛,山东
boston,Boston,Massachusetts,United States,study,2026-08-25,Present,-71.0589,42.3601,,`;
const stays = parseCSV(source);
const header = 'id,city,state_province,country,purpose,start,end,longitude,latitude';
const inputRow = 'test,Test City,Test Province,Test Country,study,2024-02-29,Present,12.5,-0.1';
const oneRow = row => `${header}\r\n${row}\r\n`;

assert.equal(Object.hasOwn(globalThis.LifeTrajectoryData, 'stays'), false, 'CSV is the only visit-data source');
assert.equal(gridSize, 0.5);
assert.deepEqual(stays.map(({ city, region, country, start, end, purpose }) =>
  [city, region, country, start, end, purpose]), [
  ['Dalian', 'Liaoning', 'China', '2004-02-22', '2022-08-14', 'study'],
  ['Shenzhen', 'Guangdong', 'China', '2022-08-14', '2026-07-02', 'study'],
  ['Guangzhou', 'Guangdong', 'China', '2024-05-01', '2024-05-07', 'live'],
  ['Qingdao', 'Shandong', 'China', '2026-05-20', '2026-05-25', 'travel'],
  ['Boston', 'Massachusetts', 'United States', '2026-08-25', null, 'study']
]);
assert.deepEqual(stays.map(stay => [stay.longitude, stay.latitude]), [
  [121.6147, 38.914], [114.0579, 22.5431], [113.2644, 23.1291],
  [120.3826, 36.0671], [-71.0589, 42.3601]
]);
assert.ok(stays.every(stay => !Object.hasOwn(stay, 'region1') && !Object.hasOwn(stay, 'region2')));
assert.deepEqual(parseCSV('\uFEFF\n\n' + source + '\n,,,,,,,,\n'), stays, 'BOM and blank rows are harmless');
assert.deepEqual(parseCSV(header + '\r\n'), [], 'An empty log can retain its header');
assert.equal(parseCSV(oneRow(inputRow.replace('Present', '')))[0].end, null);
assert.equal(parseCSV(oneRow(inputRow.replace('Present', 'pReSeNt')))[0].end, null);
for (const [label, key] of [['Study / work', 'study'], ['Study/work', 'study'], ['Live', 'live'], ['Travel', 'travel'], ['Transfer', 'transfer']]) {
  assert.equal(parseCSV(oneRow(inputRow.replace(',study,', `,${label},`)))[0].purpose, key);
}

// Real CSV values: embedded commas, escaped quotes, LF and CRLF inside a field.
const special = parseCSV(oneRow(inputRow.replace('Test City', '"Port, ""North"""').replace('Test Province', '"Line 1\nLine 2"')))[0];
assert.equal(special.city, 'Port, "North"');
assert.equal(special.region, 'Line 1\nLine 2');
const crlfValue = parseCSV(oneRow(inputRow.replace('Test City', '"First\r\nSecond"')))[0];
assert.equal(crlfValue.city, 'First\r\nSecond');
assert.deepEqual(parseCSV(toCSV([special, { ...crlfValue, id: 'other' }])), [special, { ...crlfValue, id: 'other' }]);
assert.throws(() => parseCSV(oneRow(inputRow.replace('Test City', '"Unclosed'))), /CSV row 2: quoted field is not closed/);
assert.throws(() => parseCSV(oneRow(inputRow.replace('Test City', '"City"extra'))), /CSV row 2: unexpected text/);
assert.throws(() => parseCSV(oneRow(inputRow.replace('Test City', 'Ci"ty'))), /CSV row 2: a quote must start/);
assert.throws(() => parseCSV(oneRow(inputRow.replace('Test City', 'City, Town'))), /CSV row 2: expected 9 columns, found 10/);
assert.throws(() => parseCSV(''), /CSV row 1: the file is empty/);
assert.throws(() => parseCSV('id,city\na,b'), /CSV row 1: missing required columns/);
assert.throws(() => parseCSV(header + ',id\n'), /column names must be unique/);
assert.throws(() => parseCSV(header + ',\n'), /column names cannot be blank/);
assert.throws(() => parseCSV(oneRow(inputRow.replace('Test City', ''))), /CSV row 2: city cannot be blank/);
assert.throws(() => parseCSV(`${header}\n\n${inputRow}\n${inputRow}\n`), /CSV row 4: id "test" is already used on row 3/);
assert.throws(() => parseCSV(`${header}\n${inputRow.replace('Test City', '"Two\nLines"')}\n${inputRow}\n`), /CSV row 4:/);

// Invalid calendar dates must fail rather than silently roll into another month.
for (const date of ['2023-02-29', '1900-02-29', '2024-04-31', '2024-00-01', '2024-13-01', '2024-01-00', '0000-01-01', '2024-2-29']) {
  assert.throws(() => parseCSV(oneRow(inputRow.replace('2024-02-29', date))), /CSV row 2: start must be a real date/);
}
assert.equal(parseCSV(oneRow(inputRow.replace('2024-02-29', '2000-02-29')))[0].start, '2000-02-29');
assert.throws(() => parseCSV(oneRow(inputRow.replace('Present', '2024-02-30'))), /CSV row 2: end must be a real/);
assert.throws(() => parseCSV(oneRow(inputRow.replace('Present', '2024-02-28'))), /CSV row 2: end cannot be earlier/);
assert.equal(parseCSV(oneRow(inputRow.replace('Present', '2024-02-29')))[0].end, '2024-02-29');
for (const bad of ['', '181', '-181', 'Infinity', 'NaN', '0x10', 'twelve']) {
  assert.throws(() => parseCSV(oneRow(inputRow.replace(',12.5,', `,${bad},`))), /CSV row 2: longitude must be a number/);
}
assert.throws(() => parseCSV(oneRow(inputRow.replace('-0.1', '90.1'))), /CSV row 2: latitude must be a number/);
assert.throws(() => parseCSV(oneRow(inputRow.replace(',study,', ',unknown,'))), /CSV row 2: purpose must be/);
assert.equal(parseCSV(oneRow(inputRow.replace(',12.5,-0.1', ',180,-90')))[0].longitude, 180);

// Region IDs are optional: preserve supplied IDs, otherwise never invent them.
assert.deepEqual(groupStays(stays, 'first'), []);
assert.deepEqual(groupStays(stays, 'second'), []);
assert.equal(groupStays(stays, 'precise').length, 5);
const withRegions = parseCSV(`${header},region1,region2\n${inputRow},TEST-1,TEST-2\n`)[0];
assert.equal(withRegions.region1, 'TEST-1');
assert.equal(withRegions.region2, 'TEST-2');
assert.deepEqual(parseCSV(toCSV([withRegions])), [withRegions]);
const regionIDs = [['CN-LN', 'CN-DL'], ['CN-GD', 'CN-SZ'], ['CN-GD', 'CN-GZ'], ['CN-SD', 'CN-QD'], ['US-MA', 'US-SUFFOLK']];
const assignedStays = stays.map((stay, i) => ({ ...stay, region1: regionIDs[i][0], region2: regionIDs[i][1] }));
const first = groupStays(assignedStays, 'first');
assert.equal(first.length, 4);
const guangdong = first.find(group => group.id === 'CN-GD');
assert.equal(guangdong.purpose, 'study');
assert.deepEqual(guangdong.stays.map(stay => stay.city), ['Shenzhen', 'Guangzhou']);
assert.equal(groupStays([...assignedStays].reverse(), 'first').find(group => group.id === 'CN-GD').purpose, 'study');
assert.equal(groupStays(assignedStays, 'second').find(group => group.id === 'CN-GZ').purpose, 'live');
assert.equal(groupStays(assignedStays, 'second').find(group => group.id === 'CN-QD').purpose, 'travel');
const priorityStays = ['transfer', 'live', 'travel', 'study'].map(purpose => ({ ...assignedStays[0], purpose }));
for (let mask = 1; mask < 2 ** priorityStays.length; mask++) {
  const subset = priorityStays.filter((stay, i) => mask & (1 << i));
  for (const records of [subset, [...subset].reverse()]) {
    for (const level of ['first', 'second', 'precise']) {
      const groups = groupStays(records, level);
      assert.equal(groups.length, 1);
      const order = level === 'first' ? ['study', 'travel', 'live', 'transfer'] : ['live', 'study', 'travel', 'transfer'];
      assert.equal(groups[0].purpose, order.find(purpose => subset.some(stay => stay.purpose === purpose)));
    }
  }
}
assert.equal(categories.transfer.color, '#5dcddd');

// Negative bins, shared cells and geographic limits.
assert.deepEqual(cellFor(stays[4]), { id: '-71.5,42.0', west: -71.5, south: 42, east: -71, north: 42.5 });
assert.deepEqual(cellFor({ longitude: -0.01, latitude: -0.01 }),
  { id: '-0.5,-0.5', west: -0.5, south: -0.5, east: 0, north: 0 });
assert.equal(cellFor({ longitude: -71, latitude: 42.5 }).id, '-71.0,42.5');
assert.equal(cellFor({ longitude: 180, latitude: 90 }).id, '-180.0,89.5');
assert.equal(cellFor({ longitude: -180, latitude: -90 }).id, '-180.0,-90.0');
assert.throws(() => cellFor({ longitude: NaN, latitude: 0 }), RangeError);
const sameCell = [{ ...stays[4], purpose: 'transfer' }, { ...stays[4], longitude: -71.2, purpose: 'travel' }];
assert.equal(groupStays(sameCell, 'precise')[0].purpose, 'travel');
assert.equal(groupStays(sameCell, 'precise')[0].stays.length, 2);
assert.throws(() => groupStays(stays, 'invalid'), RangeError);

// A sixth CSV row immediately participates in both the log and precise map data.
const added = parseCSV(source.trimEnd() + '\nparis,Paris,Ile-de-France,France,transfer,2026-09-01,2026-09-01,2.3522,48.8566,,\n');
assert.equal(added.length, 6);
assert.equal(groupStays(added, 'precise').length, 6);
assert.equal(added[5].purpose, 'transfer');
assert.deepEqual(parseCSV(toCSV(added)), added);
assert.deepEqual(parseCSV(toCSV(stays)), stays);
assert.deepEqual(parseCSV(toCSV([])), []);
assert.ok(toCSV(stays).includes('boston,Boston,Massachusetts,United States,study,2026-08-25,Present,-71.0589,42.3601,,,,\r\n'));
assert.equal(stays[4].end, null);
console.log('Trajectory CSV, sample stays, validation, region precedence, geographic cells, and export round-trip passed.');
