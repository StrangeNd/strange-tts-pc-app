import assert from 'node:assert/strict';
import {
  buildCrawlerSnapshotContract,
  normalizedCrawlerMetric,
  sanitizeCrawlerUrl,
  scrubCrawlerPayload
} from '../app/crawler-contract.mjs';

const fixture = {
  ok: true,
  url: 'https://seller-vn.tiktok.com/api/order/list?shop_id=123&token=secret-token&sessionid=secret-session',
  headers: {
    authorization: 'Bearer secret-bearer-token',
    'content-type': 'application/json'
  },
  data: {
    metrics: [{ key: 'gmv', value: 12345 }],
    cookie: 'sessionid=secret-cookie',
    nested: {
      csrfToken: 'secret-csrf',
      device_id: 'machine-secret',
      visibleStatus: 'ok'
    }
  }
};

const scrubbed = scrubCrawlerPayload(fixture);
const serialized = JSON.stringify(scrubbed);

assert.equal(scrubbed.data.metrics[0].value, 12345, 'metric values should remain usable');
assert.equal(scrubbed.data.nested.visibleStatus, 'ok', 'non-sensitive status should remain visible');
assert(!serialized.includes('secret-token'), 'query token should be scrubbed');
assert(!serialized.includes('secret-session'), 'session id should be scrubbed');
assert(!serialized.includes('secret-bearer-token'), 'authorization header should be scrubbed');
assert(!serialized.includes('secret-cookie'), 'cookie should be scrubbed');
assert(!serialized.includes('secret-csrf'), 'csrf token should be scrubbed');
assert(!serialized.includes('machine-secret'), 'machine/device id should be scrubbed');

const sanitizedUrl = sanitizeCrawlerUrl(fixture.url);
assert(sanitizedUrl.includes('shop_id=123'), 'safe query params should remain');
assert(!sanitizedUrl.includes('secret-token'), 'sensitive query params should be redacted');

const availableMetric = normalizedCrawlerMetric({
  key: 'gmv',
  label: 'GMV',
  value: 12345,
  source: 'seller-center/homepage',
  shopId: 'shop-a',
  timestamp: '2026-06-19T00:00:00.000Z'
});
const missingMetric = normalizedCrawlerMetric({
  key: 'adsSpend',
  label: 'Ads Spend',
  value: null,
  source: 'seller-ads/payment',
  shopId: 'shop-a'
});

assert.equal(availableMetric.status, 'available');
assert.equal(missingMetric.status, 'missing');
assert.equal(missingMetric.value, null, 'missing metrics must remain null, not zero');

const contract = buildCrawlerSnapshotContract({
  shopId: 'shop-a',
  sellerId: 'seller-a',
  runId: 'run-a',
  startedAt: '2026-06-19T00:00:00.000Z',
  rawDir: 'raw',
  normalizedDir: 'normalized',
  status: 'done',
  summary: { rawFiles: 2, normalizedRows: 1 }
});

assert.equal(contract.security.secretScrubbed, true);
assert.equal(contract.security.plaintextCookieExport, false);
assert.equal(contract.security.remoteUpload, false);
assert(contract.layers.some(layer => layer.key === 'raw_snapshot' && layer.scrubbed), 'raw snapshot layer must be scrubbed');
assert(contract.layers.some(layer => layer.key === 'normalized_metrics' && layer.missingDataPolicy === 'missing-not-zero'));

console.log('Crawler contract smoke passed.');
