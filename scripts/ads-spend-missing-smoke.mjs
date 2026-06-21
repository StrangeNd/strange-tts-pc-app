import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { analyzeBusinessInput } from '../app/business-analysis.mjs';

async function workbookBase64(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

const ordersFile = await workbookBase64([
  ['Order ID', 'Product Name', 'Seller SKU', 'GMV', 'Quantity', 'Order Status'],
  ['ORDER-1', 'Demo product', 'SKU-1', 150000, 1, 'Completed']
]);

const gmvMaxFile = await workbookBase64([
  ['Campaign ID', 'Campaign Name', 'Cost', 'GMV', 'Orders'],
  ['GMV-1', 'Product GMV Max', 43000, 300000, 3]
]);

const adsActualMissingSpendFile = await workbookBase64([
  ['Campaign ID', 'Campaign Name', 'Visible Status', 'Date'],
  ['GMV-1', 'Product GMV Max', 'matched but no spend columns', '2026-06-21'],
  ['BRAND-1', 'Brand awareness', 'non gmv row', '2026-06-21']
]);

const result = await analyzeBusinessInput({
  files: [
    {
      name: 'orders.xlsx',
      type: 'orders',
      contentBase64: ordersFile
    },
    {
      name: 'gmv-max.xlsx',
      type: 'gmvMaxCreative',
      contentBase64: gmvMaxFile
    },
    {
      name: 'ads-actual-missing-spend.xlsx',
      type: 'adsActual',
      contentBase64: adsActualMissingSpendFile
    }
  ]
}, {
  rootDir: process.cwd()
});

const actual = result.ads?.actual || {};
const components = Object.fromEntries((actual.components || []).map(item => [item.key, item]));

assert.equal(actual.rowsUsed, 1, 'GMV Max ads actual row should be matched');
assert.equal(actual.skippedNonGmv, 1, 'non-GMV ads row should be skipped');
assert.equal(actual.hasSpendComponent, false, 'matched rows without spend columns must not be marked available');
assert.equal(actual.actualCost, 0, 'missing spend sources should not invent a non-zero cost');
assert(
  result.warnings.some(item => item.includes('thieu cot Cash/Credit/Ads credit') && item.includes('missing')),
  'business analysis should warn that Ads Spend is missing'
);

for (const key of ['cash', 'credit', 'adsCreditDirect', 'adsCreditProrated']) {
  assert(components[key], `${key} component should be present`);
  assert.equal(components[key].available, false, `${key} component should be unavailable`);
  assert.equal(components[key].rows, 0, `${key} component should report zero source rows`);
}

assert.equal(components.otherVisibleSpendFields.available, false);
assert.equal(components.otherVisibleSpendFields.source, 'missing');
assert.match(components.otherVisibleSpendFields.note, /No supported uploaded column/i);
assert.equal(result.costs.rawAdsActualCost, 0);
assert.equal(result.costs.adsActualCost, 0);

console.log('Ads spend missing smoke passed.');
