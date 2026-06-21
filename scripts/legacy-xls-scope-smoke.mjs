import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const userFacingFiles = [
  'public/app.js',
  'README.md',
  'docs/PC_APP_USER_GUIDE.md',
  'docs/product/PRODUCT_CONTRACT.md',
  'docs/stories/US-006-shop-business-metrics-dashboard.md'
];

const legacyXlsPattern = /\.xls(?!x)\b/i;

for (const relativePath of userFacingFiles) {
  const text = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  assert(
    !legacyXlsPattern.test(text),
    `${relativePath} must not advertise legacy .xls uploads`
  );
}

const publicApp = fs.readFileSync(path.join(rootDir, 'public', 'app.js'), 'utf8');
assert(
  publicApp.includes('accept=".xlsx,.csv,.tsv,.txt"'),
  'business upload inputs should advertise .xlsx/.csv/.tsv/.txt only'
);
assert(
  publicApp.includes('Hoac upload file gia goc (.xlsx/.csv/.tsv)'),
  'price upload helper copy should not mention legacy .xls'
);
assert(
  publicApp.includes('File TikTok Seller/Ads/KOC (.xlsx/.csv/.tsv)'),
  'business file helper copy should not mention legacy .xls'
);

const businessAnalysis = fs.readFileSync(path.join(rootDir, 'app', 'business-analysis.mjs'), 'utf8');
assert(
  businessAnalysis.includes("'.xlsx'") || businessAnalysis.includes('workbook.xlsx.load'),
  'business analysis should keep explicit .xlsx parser coverage'
);
assert(
  businessAnalysis.includes('/\\.(csv|tsv|txt)$/i'),
  'business analysis should keep CSV/TSV/TXT delimited parser coverage'
);
assert(
  !businessAnalysis.includes("'.xls'"),
  'business analysis should not claim explicit legacy .xls support'
);

console.log('Legacy XLS scope smoke passed.');
