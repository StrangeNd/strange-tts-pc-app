import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crawlCompassMonths, crawlSellerCenterDeep } from '../app/tiktokshop-crawler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find(item => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const cdpPort = Number(arg('cdp-port', process.env.STTS_TIKTOK_CDP_PORT || '58849'));
const sellerId = arg('seller-id', process.env.STTS_TIKTOK_SELLER_ID || '7494478078863902049');
const shopId = arg('shop-id', process.env.STTS_TIKTOK_SHOP_ID || sellerId);
const mode = arg('mode', process.env.STTS_TIKTOK_CRAWL_MODE || 'compass');
const months = arg('months', '2026-04,2026-05')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const result = mode === 'seller-center'
  ? await crawlSellerCenterDeep({
    rootDir,
    cdpPort,
    shopId,
    sellerId,
    baseUrl: arg('base-url', 'https://seller-vn.tiktok.com/homepage?shop_region=VN'),
    dateRange: arg('date-range', 'yesterday'),
    maxModules: Number(arg('max-modules', '0')),
    dryRun: arg('dry-run', '0') === '1',
    clickAllControls: arg('click-all-controls', '0') === '1',
    maxSafeControls: Number(arg('max-safe-controls', '28'))
  })
  : await crawlCompassMonths({
    rootDir,
    cdpPort,
    shopId,
    sellerId,
    months
  });

console.log(JSON.stringify(result, null, 2));
