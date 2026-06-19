import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildAllShopOverviewsFromCrawler } from '../app/business-analysis.mjs';
import { buildSellerCenterFixtureRun, loadSellerCenterLatest } from '../app/tiktokshop-crawler.mjs';

const rootDir = mkdtempSync(path.join(tmpdir(), 'strange-crawler-fixture-'));
const secretNeedles = [
  'secret-token',
  'secret-session',
  'secret-cookie',
  'secret-csrf',
  'secret-request',
  'secret-row',
  'machine-secret'
];

function readGeneratedText(dir) {
  const parts = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(file);
      } else {
        parts.push(readFileSync(file, 'utf8'));
      }
    }
  }
  walk(dir);
  return parts.join('\n');
}

try {
  const report = buildSellerCenterFixtureRun({
    rootDir,
    shopId: 'fixture-shop',
    sellerId: 'fixture-seller',
    fixtureRunId: 'fixture-run-001',
    dateRange: { start: '2026-06-19', end: '2026-06-19', label: 'Fixture day' },
    rawResponses: [
      {
        url: 'https://seller-vn.tiktok.com/api/seller_center/homepage/stats?shop_id=fixture-shop&token=secret-token&sessionid=secret-session',
        method: 'POST',
        status: 200,
        contentType: 'application/json',
        requestPostData: '{"authorization":"Bearer secret-request"}',
        body: {
          data: {
            segments: [
              {
                date_range: 0,
                interval: {
                  start_date: '2026-06-19',
                  end_date: '2026-06-19',
                  stats: {
                    gmv: '123450',
                    orders_cnt: '12',
                    product_sold_cnt: '16',
                    visitors_cnt: '345'
                  }
                },
                compare_to_interval: {
                  start_date: '2026-06-18',
                  end_date: '2026-06-18',
                  stats: {
                    gmv: '111000',
                    orders_cnt: '10',
                    product_sold_cnt: '14',
                    visitors_cnt: '320'
                  }
                }
              },
              {
                date_range: 1,
                interval: {
                  start_date: '2026-06-13',
                  end_date: '2026-06-19',
                  stats: {
                    gmv: '812000',
                    orders_cnt: '77',
                    product_sold_cnt: '102',
                    visitors_cnt: '2300'
                  }
                },
                compare_to_interval: {
                  start_date: '2026-06-06',
                  end_date: '2026-06-12',
                  stats: {
                    gmv: '735000',
                    orders_cnt: '69',
                    product_sold_cnt: '91',
                    visitors_cnt: '2100'
                  }
                }
              }
            ],
            visibleStatus: 'ok',
            nested: {
              csrfToken: 'secret-csrf',
              device_id: 'machine-secret'
            }
          }
        }
      },
      {
        url: 'https://seller-vn.tiktok.com/api/seller/growth_center/performance/list?shop_id=fixture-shop',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        body: {
          data: {
            indicators: [
              { title: 'Shop score', name: 'shop_score', value: '91' },
              { title: 'Ads Spend', name: 'ads_spend', value: null, status: 'missing' }
            ],
            cookie: 'secret-cookie',
            authorization: 'Bearer secret-row'
          }
        }
      }
    ]
  });

  assert.equal(report.ok, true);
  assert.equal(report.runId, 'fixture-run-001');
  assert.equal(report.summary.rawFiles, 2);
  assert(report.summary.normalizedRows > 0, 'fixture should create normalized rows');

  const latest = loadSellerCenterLatest(rootDir, 'fixture-shop');
  assert.equal(latest.runId, 'fixture-run-001');
  assert.equal(latest.outputDir, path.join('seller-center', 'fixture-run-001'));

  const generatedText = readGeneratedText(rootDir);
  for (const needle of secretNeedles) {
    assert(!generatedText.includes(needle), `${needle} should be scrubbed from fixture output`);
  }
  assert(generatedText.includes('visibleStatus'), 'safe status fields should remain visible');
  assert(generatedText.includes('123450'), 'safe metric values should remain usable');

  const contractFile = path.join(report.outputDir, 'snapshot-contract.json');
  const contract = JSON.parse(readFileSync(contractFile, 'utf8'));
  assert.equal(contract.source, 'tiktokshop-crawler:seller-center-fixture');
  assert.equal(contract.status, 'done');
  assert.equal(contract.security.secretScrubbed, true);
  assert(contract.layers.some(layer => layer.key === 'normalized_metrics' && layer.missingDataPolicy === 'missing-not-zero'));

  const recordsFile = path.join(report.outputDir, 'normalized', 'records.json');
  assert(existsSync(recordsFile), 'normalized records should be written');
  const records = JSON.parse(readFileSync(recordsFile, 'utf8'));
  assert(records.some(row => String(row.source || '').includes('/seller_center/homepage/stats')));

  const overviews = buildAllShopOverviewsFromCrawler(rootDir, {}, { shopId: 'fixture-shop' });
  const overview = overviews.find(item => item.shopId === 'fixture-shop');
  assert(overview, 'business overview should pick up fixture crawler run');
  assert.equal(overview.ok, true);
  assert.equal(overview.runId, 'fixture-run-001');
  assert(overview.cards.some(card => card.key === 'gmv' && card.available && card.value === 812000));
  assert(overview.notes.some(note => note.includes('--')), 'missing data note should remain explicit');

  console.log('Crawler fixture smoke passed.');
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
