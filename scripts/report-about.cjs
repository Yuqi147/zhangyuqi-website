// Regenerate the About map's coverage report after editing the CSV or boundaries.
const fs = require('node:fs');
const path = require('node:path');
require('../js/trajectory-data.js');
require('../js/trajectory-regions.js');

const root = path.resolve(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'data/life-trajectory.csv'), 'utf8');
const stays = globalThis.LifeTrajectoryData.parseCSV(csv);
const geography = {};
for (const [layer, file] of Object.entries({
  world: 'world', first: 'regions-1', firstBackground: 'first-background', second: 'regions-2',
})) {
  geography[layer] = JSON.parse(fs.readFileSync(path.join(root, 'assets/geography', file + '.geojson'), 'utf8'));
}
const { warnings } = globalThis.LifeTrajectoryRegions.resolveStays(stays, geography);
const entries = [...new Set(warnings)].sort();
const report = ['About map coverage', `Stays checked: ${stays.length}`, `Distinct warnings: ${entries.length}`, '', ...entries];
fs.writeFileSync(path.join(root, 'report_about.log'), report.join('\n') + '\n', 'utf8');
