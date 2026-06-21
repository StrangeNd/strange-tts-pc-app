import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildAllShopOverviewsFromCrawler } from '../app/business-analysis.mjs';
import { buildSellerCenterFixtureRun } from '../app/tiktokshop-crawler.mjs';

const rootDir = mkdtempSync(path.join(tmpdir(), 'strange-shop-health-'));

try {
  buildSellerCenterFixtureRun({
    rootDir,
    shopId: 'health-shop',
    sellerId: 'health-seller',
    fixtureRunId: 'health-run-001',
    dateRange: { start: '2026-06-15', end: '2026-06-21', label: 'Health fixture week' },
    rawResponses: [
      {
        url: 'https://seller-vn.tiktok.com/api/seller_center/homepage/stats?shop_id=health-shop',
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
                  stats: {
                    gmv: '1900000',
                    orders_cnt: '95',
                    visitors_cnt: '3210',
                    updated_time: '2026-06-21T09:00:00.000Z'
                  }
                },
                compare_to_interval: {
                  start_date: '2026-06-08',
                  end_date: '2026-06-14',
                  stats: {
                    gmv: '1750000',
                    orders_cnt: '88',
                    visitors_cnt: '3001'
                  }
                }
              }
            ]
          }
        }
      },
      {
        url: 'https://seller-vn.tiktok.com/api/seller/growth_center/performance/list?shop_id=health-shop',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        body: {
          data: {
            indicators: [
              {
                title: 'Negative review rate',
                name: 'negative_review_rate_60d',
                value: '0.2',
                explanation: '60-day negative review rate'
              },
              {
                title: 'Seller fault refund return rate',
                name: 'seller_fault_refund_return_rate_60d',
                value: '0.1',
                explanation: '60-day seller fault refund/return rate'
              },
              {
                title: 'Fast dispatch rate',
                name: 'fast_dispatch_rate_30d',
                value: '96',
                explanation: '30-day fast shipping rate'
              },
              {
                title: 'Seller after-sales handling time',
                name: 'imart_hour_after_sale_handle_time_60d',
                value: '7',
                explanation: '60-day after-sales handling time'
              },
              {
                title: '12-hour reply rate',
                name: '12h_reply_rate_30d',
                value: '0.94',
                explanation: '30-day 12-hour response rate'
              }
            ]
          }
        }
      },
      {
        url: 'https://seller-vn.tiktok.com/api/seller/growth_center/violation/overview/get?shop_id=health-shop',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        body: {
          data: {
            violation_score: 4.8,
            section_infos: [
              { left_node: 0, right_node: 5, risk_level: 'Low risk' }
            ],
            violation_points_v2: [
              {
                id: 'late_ship',
                title: 'Late shipment warning',
                appeal_status: 'Chua khieu nai',
                count: 2
              },
              {
                id: 'listing_quality',
                violation_type: 'Listing quality issue',
                status: 'Khong can khieu nai',
                count: 0
              }
            ]
          }
        }
      }
    ]
  });

  const overviews = buildAllShopOverviewsFromCrawler(rootDir, {}, { shopId: 'health-shop' });
  const overview = overviews.find(item => item.shopId === 'health-shop');
  assert(overview, 'shop overview should include the health fixture shop');
  assert.equal(overview.ok, true);

  const last7 = overview.ranges.find(item => item.key === 'last7');
  assert(last7?.healthCenter, 'last7 range should expose healthCenter');
  const health = last7.healthCenter;

  assert.equal(health.score.available, true, 'Shop Score should be available from violation overview');
  assert.equal(health.score.value, 4.8);
  assert.equal(health.violations.summary.available, true, 'Violation summary should be available');
  assert.equal(health.violations.summary.value, 2, 'Violation count should preserve explicit zero rows without inventing extra violations');
  assert.equal(health.violations.risk, 'Low risk');
  assert.equal(health.violations.items.length, 2);
  assert.equal(health.violations.items[0].title, 'Late shipment warning');
  assert.equal(health.violations.items[0].status, 'Chua khieu nai');
  assert(health.violations.items[0].source.includes('/violation/overview/get'));

  const productSatisfaction = health.components.find(item => item.key === 'productSatisfaction');
  assert(productSatisfaction, 'Product Satisfaction component should be present');
  assert.equal(productSatisfaction.available, true);
  assert.equal(productSatisfaction.dependencies.length, 2);
  assert(productSatisfaction.dependencies.every(item => item.available), 'Product Satisfaction dependencies should render separately and available');
  assert.equal(productSatisfaction.value, (5 - 0.2 - 0.1) * 0.7);

  const fulfillment = health.components.find(item => item.key === 'fulfillmentLogistics');
  assert(fulfillment, 'Fulfillment and Logistics component should be present');
  assert.equal(fulfillment.available, false, 'Missing seller fault cancel rate must block computed score');
  assert.equal(fulfillment.value, null, 'Missing health dependencies must not be treated as zero');
  assert(
    health.missingDependencies.includes('Cancellation rate due to seller fault in 30 days'),
    'Missing dependency list should name seller fault cancellation'
  );

  const customerService = health.components.find(item => item.key === 'customerService');
  assert(customerService, 'Customer Service component should be present');
  assert.equal(customerService.available, false, 'Customer Service must not invent a score');
  assert.equal(customerService.value, null);
  assert.match(customerService.formula, /No complete formula yet/i);
  assert.equal(customerService.dependencies.length, 2);
  assert(customerService.dependencies.every(item => item.available), 'Customer Service component metrics should still be visible');

  console.log('Shop health score smoke passed.');
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
