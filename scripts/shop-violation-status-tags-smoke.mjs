import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildAllShopOverviewsFromCrawler } from '../app/business-analysis.mjs';
import { buildSellerCenterFixtureRun } from '../app/tiktokshop-crawler.mjs';

const rootDir = mkdtempSync(path.join(tmpdir(), 'strange-violation-status-'));

try {
  buildSellerCenterFixtureRun({
    rootDir,
    shopId: 'violation-status-shop',
    sellerId: 'violation-status-seller',
    fixtureRunId: 'violation-status-run-001',
    dateRange: { start: '2026-06-15', end: '2026-06-21', label: 'Violation status fixture week' },
    rawResponses: [
      {
        url: 'https://seller-vn.tiktok.com/api/seller_center/homepage/stats?shop_id=violation-status-shop',
        method: 'POST',
        status: 200,
        contentType: 'application/json',
        body: {
          data: {
            segments: [
              {
                date_range: 1,
                interval: {
                  start_date: '2026-06-15',
                  end_date: '2026-06-21',
                  stats: { gmv: '100000', orders_cnt: '5', visitors_cnt: '200' }
                },
                compare_to_interval: { stats: {} }
              }
            ]
          }
        }
      },
      {
        url: 'https://seller-vn.tiktok.com/api/seller/growth_center/violation/overview/get?shop_id=violation-status-shop',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        body: {
          data: {
            violation_score: 3.5,
            violation_points_v2: [
              { id: 'not-appealed', title: 'Not appealed fixture', appeal_status: 'not_appealed', count: 1 },
              { id: 'appeal-failed', title: 'Appeal failed fixture', status: 'appeal_failed', count: 1 },
              { id: 'appeal-success', title: 'Appeal success fixture', appealStatus: 'approved', count: 1 },
              { id: 'no-appeal-needed', title: 'No appeal needed fixture', state: 'not_required', count: 0 }
            ]
          }
        }
      }
    ]
  });

  const overview = buildAllShopOverviewsFromCrawler(rootDir, {}, { shopId: 'violation-status-shop' })
    .find(item => item.shopId === 'violation-status-shop');
  assert(overview, 'shop overview should include violation status fixture');

  const last7 = overview.ranges.find(item => item.key === 'last7');
  const items = last7?.healthCenter?.violations?.items || [];
  assert.equal(items.length, 4, 'fixture should expose four violation rows');
  assert.deepEqual(
    items.map(item => item.status),
    ['Chua khieu nai', 'Khieu nai khong thanh cong', 'Thanh cong', 'Khong can khieu nai'],
    'violation statuses should normalize to SPEC appeal/status tags'
  );
  assert.equal(last7.healthCenter.violations.summary.value, 3, 'zero-count status rows should not inflate violation count');
  assert(items.every(item => item.source.includes('/violation/overview/get')), 'violation rows should preserve source URL');
  assert(items.every(item => item.timestamp), 'violation rows should preserve crawler capture timestamp');
  assert.equal(
    last7.healthCenter.violations.timestamp,
    items[0].timestamp,
    'violation summary should expose the same crawler capture timestamp as rows'
  );

  console.log('Shop violation status tags smoke passed.');
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
