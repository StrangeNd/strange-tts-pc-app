import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildSellerCenterFixtureRun, buildTargetInventory } from '../app/tiktokshop-crawler.mjs';

const rootDir = mkdtempSync(path.join(tmpdir(), 'strange-target-overview-inventory-'));

try {
  const direct = buildTargetInventory({
    target: 'overview',
    runId: 'direct-inventory',
    apiLog: [
      { url: 'https://seller-vn.tiktok.com/api/seller_center/homepage/stats?token=secret-token&shop_id=safe-shop' },
      { url: 'https://seller-vn.tiktok.com/api/seller/growth_center/violation/overview/get?sessionid=secret-session' }
    ],
    rawEntries: [{ file: 'raw/0001.json' }, { file: 'raw/0002.json' }],
    normalizedRows: [{
      gmv: 1200,
      orders_cnt: 3,
      visitors_cnt: 40,
      conversion_rate: 0.075,
      violation_score: 4.8
    }],
    dataDictionary: {
      'data.gmv': { path: 'data.gmv' },
      'data.orders_cnt': { path: 'data.orders_cnt' },
      'data.visitors_cnt': { path: 'data.visitors_cnt' },
      'data.conversion_rate': { path: 'data.conversion_rate' },
      'data.violation_score': { path: 'data.violation_score' }
    }
  });

  assert.equal(direct.classification, 'TARGET_CAPTURE_READY');
  assert(direct.endpointPaths.includes('/api/seller_center/homepage/stats'));
  assert(direct.endpointPaths.includes('/api/seller/growth_center/violation/overview/get'));
  assert.equal(direct.rawFileCount, 2);
  assert.equal(direct.normalizedRecordCount, 1);
  assert.equal(direct.coreMetricPresence.gmv, true);
  assert.equal(direct.coreMetricPresence.orders, true);
  assert.equal(direct.coreMetricPresence.visitors, true);
  assert.equal(direct.coreMetricPresence.conversionRate, true);
  assert.equal(direct.coreMetricPresence.shopScore, true);
  assert(!JSON.stringify(direct).includes('secret-token'), 'target inventory must not expose query token values');
  assert(!JSON.stringify(direct).includes('secret-session'), 'target inventory must not expose session query values');

  const fixture = buildSellerCenterFixtureRun({
    rootDir,
    shopId: 'target-overview-shop',
    sellerId: 'target-overview-seller',
    fixtureRunId: 'target-overview-run-001',
    target: 'overview',
    rawResponses: [
      {
        url: 'https://seller-vn.tiktok.com/api/seller_center/homepage/stats?shop_id=target-overview-shop&token=secret-token',
        body: {
          data: {
            segments: [{
              interval: {
                gmv: 1200,
                orders_cnt: 3,
                visitors_cnt: 40,
                impressions: 400,
                refund_orders: 1,
                conversion_rate: 0.075,
                aov: 400
              }
            }]
          }
        }
      },
      {
        url: 'https://seller-vn.tiktok.com/api/seller/growth_center/novice/record/get?shop_id=target-overview-shop',
        body: { data: { task_complete_count: 2, task_total_count: 5 } }
      }
    ]
  });

  assert.equal(fixture.targetInventory.classification, 'TARGET_CAPTURE_READY');
  assert.equal(fixture.targetInventory.coreMetricPresence.aov, true);
  assert.equal(fixture.targetInventory.coreMetricPresence.tasks, true);
  assert(fixture.targetInventory.metricHints.includes('task'));
  assert(!JSON.stringify(fixture.targetInventory).includes('secret-token'));

  console.log('Targeted overview inventory smoke passed.');
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
