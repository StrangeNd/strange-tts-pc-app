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
  ['Order ID', 'Product Name', 'Seller SKU', 'GMV', 'Quantity', 'Order Status', 'Refund Amount', 'Cancel Amount'],
  ['ORDER-1', 'Demo TikTok Shop product', 'SKU-1', 120000, 2, 'Completed', '', ''],
  ['ORDER-2', 'Demo TikTok Shop product', 'SKU-1', 80000, 1, 'Refunded', 20000, ''],
  ['ORDER-3', 'Demo TikTok Shop product', 'SKU-1', 50000, 1, 'Cancelled', '', 50000]
]);

const orderMissingSourceFile = await workbookBase64([
  ['Order ID', 'Product Name', 'Seller SKU', 'GMV', 'Quantity'],
  ['ORDER-4', 'Demo TikTok Shop product', 'SKU-1', 120000, 2]
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

const videoFile = await workbookBase64([
  ['Video Name', 'GMV', 'Orders', 'Views'],
  ['Launch video', 40000, 3, 1000],
  ['Demo clip', 10000, 1, 300]
]);

const livestreamFile = await workbookBase64([
  ['Live Name', 'Live GMV', 'Live Orders', 'Views', 'Duration Minutes'],
  ['Morning live', 90000, 6, 1500, 120],
  ['Evening live', 30000, 2, 700, 60]
]);

const affiliateFile = await workbookBase64([
  ['Product Name', 'Creator Name', 'Affiliate GMV', 'Affiliate Orders', 'Commission'],
  ['Demo TikTok Shop product', 'Creator A', 70000, 5, 7000],
  ['Second product', 'Creator B', 20000, 2, 2000]
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
    },
    {
      name: 'video-list.xlsx',
      type: 'video',
      contentBase64: videoFile
    },
    {
      name: 'livestream-list.xlsx',
      type: 'livestream',
      contentBase64: livestreamFile
    },
    {
      name: 'affiliate-performance.xlsx',
      type: 'affiliate',
      contentBase64: affiliateFile
    }
  ]
}, {
  rootDir: process.cwd()
});

const orderSummary = result.fileSummary.find(item => item.name === 'orders.xlsx');
if (!orderSummary || orderSummary.rows !== 3) {
  throw new Error(`Expected 3 parsed order rows, got ${orderSummary?.rows ?? 'none'}`);
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

if (!result.orders?.refundCancel?.available) {
  throw new Error('Expected refund/cancel metrics to be available from order status columns.');
}

if (result.orders.refundCancel.affectedOrders !== 2) {
  throw new Error(`Expected 2 refund/cancel orders, got ${result.orders.refundCancel.affectedOrders}`);
}

if (result.orders.refundCancel.amount !== 70000) {
  throw new Error(`Expected refund/cancel amount 70000, got ${result.orders.refundCancel.amount}`);
}

if (Math.abs(result.orders.refundCancel.affectedRate - (2 / 3)) > 0.000001) {
  throw new Error(`Expected refund/cancel rate 2/3, got ${result.orders.refundCancel.affectedRate}`);
}

const topSku = result.orders.topSkus[0];
if (topSku.netRevenueEstimate !== 180000) {
  throw new Error(`Expected top SKU net revenue estimate 180000, got ${topSku.netRevenueEstimate}`);
}

if (result.content?.video?.gmv !== 50000 || result.content?.video?.orders !== 4) {
  throw new Error(`Expected video GMV/orders 50000/4, got ${result.content?.video?.gmv}/${result.content?.video?.orders}`);
}

if (result.content?.livestream?.gmv !== 120000 || result.content?.livestream?.orders !== 8) {
  throw new Error(`Expected livestream GMV/orders 120000/8, got ${result.content?.livestream?.gmv}/${result.content?.livestream?.orders}`);
}

if (!result.affiliate?.performance?.available || result.affiliate.performance.gmv !== 90000) {
  throw new Error(`Expected product affiliate GMV 90000, got ${result.affiliate?.performance?.gmv}`);
}

if (result.affiliate.performance.commission !== 9000 || result.affiliate.performance.topProducts?.[0]?.productName !== 'Demo TikTok Shop product') {
  throw new Error('Expected affiliate commission and top product performance to be reported.');
}

const missingSourceResult = await analyzeBusinessInput({
  priceFile: {
    name: 'price.xlsx',
    contentBase64: priceFile
  },
  files: [
    {
      name: 'orders-missing-source.xlsx',
      type: 'orders',
      contentBase64: orderMissingSourceFile
    }
  ]
}, {
  rootDir: process.cwd()
});

if (missingSourceResult.ads?.actual?.hasSpendComponent) {
  throw new Error('Expected Ads Spend to remain unavailable when no ads source file is uploaded.');
}

if (missingSourceResult.ads?.actual?.components?.some(component => component.available)) {
  throw new Error('Expected Ads Spend components to remain missing when no source fields are uploaded.');
}

if (missingSourceResult.orders?.refundCancel?.available) {
  throw new Error('Expected refund/cancel metrics to remain unavailable when status/refund/cancel fields are absent.');
}

if (
  missingSourceResult.orders?.refundCancel?.affectedOrders !== null ||
  missingSourceResult.orders?.refundCancel?.amount !== null
) {
  throw new Error('Expected missing refund/cancel counts and amount to stay null, not zero.');
}

const missingSourceTopSku = missingSourceResult.orders?.topSkus?.[0];
if (!missingSourceTopSku || missingSourceTopSku.netRevenueEstimate !== null) {
  throw new Error('Expected SKU net revenue estimate to stay missing without refund/cancel source fields.');
}

if (
  missingSourceResult.groupedRows?.video !== 0 ||
  missingSourceResult.groupedRows?.livestream !== 0 ||
  missingSourceResult.groupedRows?.affiliate !== 0
) {
  throw new Error('Expected content and affiliate source row counts to stay zero when files are absent.');
}

if (missingSourceResult.affiliate?.performance?.available) {
  throw new Error('Expected product affiliate performance to remain unavailable when no affiliate source file is uploaded.');
}

if (missingSourceResult.affiliate?.performance?.gmv !== null) {
  throw new Error('Expected missing affiliate GMV to stay null, not zero.');
}

console.log('Spreadsheet smoke passed');
