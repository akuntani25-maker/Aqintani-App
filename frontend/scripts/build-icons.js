// Builds a small Solar (bold-duotone) icon subset for offline use: node scripts/build-icons.js
const fs = require('fs');
const path = require('path');
const { getIcons } = require('@iconify/utils');
const solar = require('@iconify-json/solar/icons.json');
const { ICON_MAP } = require('../src/components/icons/map.json');

const names = [...new Set(Object.values(ICON_MAP))].map((n) => `${n}-bold-duotone`);
const missing = names.filter((n) => !solar.icons[n] && !(solar.aliases || {})[n]);
if (missing.length) {
  console.error('Missing icons:', missing.join(', '));
  process.exit(1);
}
const subset = getIcons(solar, names);
fs.writeFileSync(path.join(__dirname, '../src/components/icons/solar-subset.json'), JSON.stringify(subset));
console.log(`Wrote ${names.length} icons`);
