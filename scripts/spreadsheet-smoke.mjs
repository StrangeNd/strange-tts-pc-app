import ExcelJS from 'exceljs';
import { analyzeBusinessInput } from '../app/business-analysis.mjs';

async function workbookBase64(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Orders');
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

const orderFile = await workbookBase64([
  ['Order ID', 'Product Name', 'Seller SKU', 'GMV', 'Quantity'],
  ['ORDER-1', 'Demo TikTok Shop product', 'SKU-1', 120000, 2],
  ['ORDER-2', 'Demo TikTok Shop product', 'SKU-1', 80000, 1]
]);

const priceFile = await workbookBase64([
  ['Product Name', '', '', '', '', '', '', 'Cost'],
  ['Demo TikTok Shop product', '', '', '', '', '', '', 30000]
]);

const adsActualFile = await workbookBase64([
  ['Campaign ID', 'Campaign Name', 'Cash Cost', 'Credit Cost', 'Ad Credit Cost', 'Date'],
  ['C1', 'Product GMV Max', 10000, 2000, 500, '2026-06-01'],
  ['C2', 'Product GMV Max', '', '', 1000, '2026-06-01'],
  ['C3', 'Brand awareness', 999, 999, 999, '2026-06-01']
]);

const gmvMaxFile = await workbookBase64([
  ['Campaign ID', 'Campaign Name', 'Cost', 'GMV', 'Orders'],
  ['C1', 'Product GMV Max', 12500, 50000, 4],
  ['C2', 'Product GMV Max', 250, 2000, 1]
]);

const result = await analyzeBusinessInput({
  priceFile: {
    name: 'price.xlsx',
    contentBase64: priceFile
  },
  adsCreditRatio: 0.25,
  files: [
    {
      name: 'orders.xlsx',
      type: 'orders',
      contentBase64: orderFile
    },
    {
      name: 'ads-actual.xlsx',
      type: 'adsActual',
      contentBase64: adsActualFile
    },
    {
      name: 'gmv-max-creative-data.xlsx',
      type: 'gmvMaxCreative',
      contentBase64: gmvMaxFile
    }
  ]
}, {
  rootDir: process.cwd()
});

const orderSummary = result.fileSummary.find(item => item.name === 'orders.xlsx');
if (!orderSummary || orderSummary.rows !== 2) {
  throw new Error(`Expected 2 parsed order rows, got ${orderSummary?.rows ?? 'none'}`);
}

if (!result.orders?.topSkus?.length) {
  throw new Error('Expected parsed workbook rows to produce top SKU data.');
}

if (result.ads?.actual?.cash !== 10000) {
  throw new Error(`Expected ads cash component 10000, got ${result.ads?.actual?.cash}`);
}

if (result.ads?.actual?.credit !== 2000) {
  throw new Error(`Expected ads credit component 2000, got ${result.ads?.actual?.credit}`);
}

if (result.ads?.actual?.adsCreditDirect !== 500) {
  throw new Error(`Expected direct ads credit 500, got ${result.ads?.actual?.adsCreditDirect}`);
}

if (result.ads?.actual?.adsCreditProrated !== 250) {
  throw new Error(`Expected prorated ads credit 250, got ${result.ads?.actual?.adsCreditProrated}`);
}

if (result.ads?.actual?.actualCost !== 12750) {
  throw new Error(`Expected total ads actual cost 12750, got ${result.ads?.actual?.actualCost}`);
}

if (!result.ads?.actual?.hasSpendComponent || result.ads?.actual?.skippedNonGmv !== 1) {
  throw new Error('Expected ads component availability and non-GMV row skip to be reported.');
}

console.log('Spreadsheet smoke passed');
