import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildAllShopOverviewsFromCrawler } from '../app/business-analysis.mjs';
import { sanitizeCrawlerUrl, scrubCrawlerPayload } from '../app/crawler-contract.mjs';

const rootDir = mkdtempSync(path.join(tmpdir(), 'strange-real-crawl-overview-'));

try {
  const shopId = 'fixture-compass-shop';
  const shopDir = path.join(rootDir, 'data', 'tiktokshop-crawler', 'shops', shopId);
  mkdirSync(shopDir, { recursive: true });
  writeFileSync(path.join(shopDir, 'compass-overview-db.json'), JSON.stringify({
    sellerId: 'seller-fixture',
    updatedAt: '2026-06-24T05:42:32.542Z',
    months: {
      '2026-05': {
        start: '2026-05-01',
        end: '2026-06-01',
        crawledAt: '2026-06-01T00:00:00.000Z',
        aggregate: [{ startDate: '2026-05-01', endDate: '2026-06-01', totalGmv: 1000 }],
        daily: []
      },
      '2026-06': {
        start: '2026-06-01',
        end: '2026-07-01',
        crawledAt: '2026-06-24T05:42:32.542Z',
        readyTime: '2026-06-08',
        rawFiles: {
          aggregate: 'raw/2026-06-aggregate.json',
          daily: 'raw/2026-06-daily.json'
        },
        aggregate: [{
          startDate: '2026-06-01',
          endDate: '2026-07-01',
          totalGmv: 76714095,
          contentVideoGmv: 55389662,
          contentProductCardGmv: 1200,
          contentLiveGmv: 3400,
          affiliateTotalGmv: 5000,
          sellerTotalGmv: 6000
        }],
        daily: [
          { startDate: '2026-06-01', endDate: '2026-06-02', totalGmv: 100, contentVideoGmv: 10 },
          { startDate: '2026-06-02', endDate: '2026-06-03', totalGmv: 200, contentVideoGmv: 20 },
          { startDate: '2026-06-03', endDate: '2026-06-04', totalGmv: 300, contentVideoGmv: 30 },
          { startDate: '2026-06-04', endDate: '2026-06-05', totalGmv: 400, contentVideoGmv: 40 },
          { startDate: '2026-06-05', endDate: '2026-06-06', totalGmv: 500, contentVideoGmv: 50 },
          { startDate: '2026-06-06', endDate: '2026-06-07', totalGmv: 600, contentVideoGmv: 60 },
          { startDate: '2026-06-07', endDate: '2026-06-08', totalGmv: 700, contentVideoGmv: 70 },
          { startDate: '2026-06-08', endDate: '2026-06-09', totalGmv: 800, contentVideoGmv: 80 },
          { startDate: '2026-06-27', endDate: '2026-06-28', totalGmv: 0, contentVideoGmv: 0 },
          { startDate: '2026-06-28', endDate: '2026-06-29', totalGmv: 0, contentVideoGmv: 0 },
          { startDate: '2026-06-29', endDate: '2026-06-30', totalGmv: 0, contentVideoGmv: 0 },
          { startDate: '2026-06-30', endDate: '2026-07-01', totalGmv: 0, contentVideoGmv: 0 }
        ]
      }
    }
  }, null, 2));

  const overviews = buildAllShopOverviewsFromCrawler(rootDir, {}, { shopId, sellerId: 'seller-fixture' });
  const compass = overviews.find(item => item.shopId === shopId && item.sourceType === 'compass');
  assert(compass, 'shop overview should include the latest Compass database');
  assert.equal(compass.runId, 'compass-2026-06');
  assert.equal(compass.defaultRangeKey, 'month');
  assert.deepEqual(compass.availableMonths, ['2026-05', '2026-06']);
  assert(compass.cards.some(card => card.key === 'gmv' && card.value === 76714095 && card.available));
  assert(compass.cards.some(card => card.key === 'orders' && card.value === null && !card.available), 'missing orders must stay missing');
  assert(compass.ranges.some(range => range.key === 'today' && range.cards.some(card => card.key === 'gmv' && card.value === null && !card.available)), 'today should stay missing when TikTok ready_time has no today row');
  assert(compass.ranges.some(range => range.key === 'yesterday'), 'overview should expose a yesterday range');
  assert(compass.ranges.some(range => range.key === 'last7' && range.cards.some(card => card.key === 'gmv' && card.value === 3500)), 'last7 should ignore future zero rows after ready_time');
  const last7 = compass.ranges.find(range => range.key === 'last7');
  assert(last7.rawMappings?.some(item => item.metricId === 4024 && item.value === 3500 && item.rawValues.length === 7), 'last7 should expose raw GMV mapping for manual Seller UI review');

  const leaky = {
    endpoint: 'https://seller-vn.tiktok.com/api/path?msToken=secret-token&fp=secret-fp&cookie_enabled=true&safe=visible',
    ranges: [{
      healthCenter: {
        violations: {
          source: 'https://seller-vn.tiktok.com/api/violations?x-bogus=secret-bogus&sessionid=secret-session&safe=visible',
          items: [{
            source: 'https://seller-vn.tiktok.com/api/item?token=secret-token&safe=visible'
          }]
        }
      }
    }]
  };
  const scrubbed = scrubCrawlerPayload(leaky);
  const serialized = JSON.stringify(scrubbed);
  assert(!/msToken|fp=|cookie_enabled|x-bogus|sessionid|secret-/i.test(serialized), 'overview payload must not expose secret URL params');
  assert(serialized.includes('safe=visible'), 'safe URL params should remain available for debugging context');

  const sanitized = sanitizeCrawlerUrl(leaky.endpoint);
  assert(!/msToken|fp=|cookie_enabled/i.test(sanitized), 'sanitizeCrawlerUrl should delete sensitive query params');
  assert(sanitized.includes('safe=visible'), 'sanitizeCrawlerUrl should retain safe query params');

  const crawlerSource = readFileSync(path.join(process.cwd(), 'app', 'tiktokshop-crawler.mjs'), 'utf8');
  assert(crawlerSource.includes("includes('/compass/data-overview')"), 'findCompassPage should prefer Compass data overview tabs');
  assert(crawlerSource.includes("includes('seller-vn.tiktok.com')"), 'findCompassPage should prefer Seller Center origin pages');
  assert(crawlerSource.includes("!String(tab.url || '').includes('permission-request-dialog')"), 'findCompassPage should avoid permission dialog tabs');
  assert(crawlerSource.includes("!String(tab.url || '').startsWith('edge://')"), 'findCompassPage should avoid Edge internal targets before fallback');
  assert(crawlerSource.includes("Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 180000"), 'daily Compass loop should have an extended CDP timeout');

  const appSource = readFileSync(path.join(process.cwd(), 'public', 'app.js'), 'utf8');
  assert(appSource.includes('renderDashboardRawMappings(range)'), 'dashboard should render raw Compass mappings for manual review');
  assert(appSource.includes("mode: 'compass'"), 'dashboard realtime refresh should trigger a Compass crawl');
  assert(appSource.includes('months: [currentMonthKey()]'), 'dashboard realtime refresh should crawl the current month');
  assert(appSource.includes("autoOpenProfile: true"), 'dashboard realtime refresh should use the selected managed shop profile');

  console.log('Real crawl overview smoke passed.');
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
