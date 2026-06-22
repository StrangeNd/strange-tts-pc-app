import assert from 'node:assert/strict';
import {
  buildCrawlerSnapshotContract,
  normalizedCrawlerMetric,
  scrubCrawlerPayload
} from '../app/crawler-contract.mjs';

const contract = buildCrawlerSnapshotContract({
  shopId: 'shop-policy',
  sellerId: 'seller-policy',
  runId: 'run-policy',
  startedAt: '2026-06-21T00:00:00.000Z',
  finishedAt: '2026-06-21T00:01:00.000Z',
  rawDir: 'raw/policy',
  normalizedDir: 'normalized/policy',
  status: 'done',
  summary: { rawFiles: 3, normalizedRows: 2 }
});

assert.equal(contract.retentionPolicy.mode, 'local-retention-policy', 'retention should be a local-only policy');
assert.equal(contract.retentionPolicy.rawSnapshotDays, 30, 'raw snapshot review window should default to 30 days');
assert.equal(contract.retentionPolicy.pruneAutomatically, false, 'contract must not claim automatic deletion');
assert.equal(contract.retentionPolicy.reviewBeforeDelete, true, 'operator review should be required before deleting crawler data');
assert.equal(contract.retentionPolicy.remoteUpload, false, 'retention policy must not enable remote upload');
assert.equal(contract.retentionPolicy.expiresAt, '2026-07-21T00:00:00.000Z', 'retention deadline should be derived from startedAt');
assert.equal(contract.security.secretScrubbed, true, 'secret scrubbing must stay enabled');
assert.equal(contract.security.plaintextCookieExport, false, 'plaintext cookie export must stay disabled');
assert.equal(contract.security.remoteUpload, false, 'crawler snapshots must not upload remotely');

for (const forbidden of ['cookies', 'tokens', 'credentials', 'authorization headers', 'machine IDs', 'license keys']) {
  assert(
    contract.security.forbiddenFields.includes(forbidden),
    `forbidden field list must include ${forbidden}`
  );
}

const layerKeys = contract.layers.map(layer => layer.key);
assert.deepEqual(layerKeys, [
  'raw_snapshot',
  'parsed_source_data',
  'normalized_metrics',
  'derived_metrics',
  'dashboard_report_view'
], 'crawler data layers must keep the documented order');

const layers = Object.fromEntries(contract.layers.map(layer => [layer.key, layer]));
assert.equal(layers.raw_snapshot.path, 'raw/policy');
assert.equal(layers.raw_snapshot.scrubbed, true);
assert.equal(layers.raw_snapshot.shownByDefault, false);
assert.equal(layers.parsed_source_data.scrubbed, true);
assert.equal(layers.normalized_metrics.path, 'normalized/policy');
assert.equal(layers.normalized_metrics.missingDataPolicy, 'missing-not-zero');
assert.equal(layers.derived_metrics.recomputable, true);
assert.equal(layers.dashboard_report_view.userFacing, true);

const zeroMetric = normalizedCrawlerMetric({
  key: 'orders',
  label: 'Orders',
  value: 0,
  source: 'seller-center/orders',
  shopId: 'shop-policy'
});
const missingMetric = normalizedCrawlerMetric({
  key: 'adsSpend',
  label: 'Ads Spend',
  value: undefined,
  source: 'seller-ads/payment',
  shopId: 'shop-policy'
});

assert.equal(zeroMetric.status, 'available', 'explicit zero values must remain available');
assert.equal(zeroMetric.value, 0, 'explicit zero values must not be converted to missing');
assert.equal(missingMetric.status, 'missing', 'undefined metric values must be missing');
assert.equal(missingMetric.value, null, 'missing metrics must remain null, not zero');

const payload = {
  rows: [
    {
      url: 'https://seller-vn.tiktok.com/path?token=row-secret&safe=visible',
      value: 42
    },
    {
      headers: {
        authorization: 'Bearer row-secret-bearer',
        cookie: 'sessionid=row-secret-cookie',
        accept: 'application/json'
      }
    }
  ],
  nested: {
    session: 'row-secret-session',
    visibleStatus: 'ok'
  }
};

const scrubbed = scrubCrawlerPayload(payload);
const serialized = JSON.stringify(scrubbed);

assert.equal(scrubbed.rows[0].value, 42, 'safe values inside arrays should remain usable');
assert.equal(scrubbed.rows[1].headers.accept, 'application/json', 'safe headers should remain visible');
assert.equal(scrubbed.nested.visibleStatus, 'ok', 'safe nested metadata should remain visible');
assert(!serialized.includes('row-secret'), 'array and nested secrets must be scrubbed recursively');

console.log('Crawler contract policy smoke passed.');
