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

const result = await analyzeBusinessInput({
  priceFile: {
    name: 'price.xlsx',
    contentBase64: priceFile
  },
  files: [
    {
      name: 'orders.xlsx',
      type: 'orders',
      contentBase64: orderFile
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

console.log('Spreadsheet smoke passed');
