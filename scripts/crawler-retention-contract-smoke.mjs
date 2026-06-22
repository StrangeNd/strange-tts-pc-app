import assert from 'node:assert/strict';
import {
  DEFAULT_CRAWLER_RAW_RETENTION_DAYS,
  buildCrawlerRetentionPolicy,
  buildCrawlerSnapshotContract
} from '../app/crawler-contract.mjs';

const startedAt = '2026-06-22T00:00:00.000Z';
const defaultPolicy = buildCrawlerRetentionPolicy({ startedAt });

assert.equal(DEFAULT_CRAWLER_RAW_RETENTION_DAYS, 30, 'default raw snapshot retention should be 30 days');
assert.equal(defaultPolicy.mode, 'local-retention-policy', 'retention must stay local-only');
assert.equal(defaultPolicy.rawSnapshotDays, 30, 'default retention window should be 30 days');
assert.equal(defaultPolicy.pruneAutomatically, false, 'retention contract should not auto-delete data');
assert.equal(defaultPolicy.reviewBeforeDelete, true, 'deletion should require explicit local review');
assert.equal(defaultPolicy.compressedRecommended, true, 'large raw snapshots should recommend compression');
assert.equal(defaultPolicy.remoteUpload, false, 'retention must not enable remote upload');
assert.equal(defaultPolicy.startedAt, startedAt);
assert.equal(defaultPolicy.expiresAt, '2026-07-22T00:00:00.000Z');

const customPolicy = buildCrawlerRetentionPolicy({ startedAt, retentionDays: 7 });
assert.equal(customPolicy.rawSnapshotDays, 7, 'custom retention days should be supported');
assert.equal(customPolicy.expiresAt, '2026-06-29T00:00:00.000Z');

const fallbackPolicy = buildCrawlerRetentionPolicy({ startedAt, retentionDays: 0 });
assert.equal(fallbackPolicy.rawSnapshotDays, 30, 'invalid retention days should fall back to default');

const contract = buildCrawlerSnapshotContract({
  shopId: 'retention-shop',
  sellerId: 'retention-seller',
  runId: 'retention-run',
  startedAt,
  rawDir: 'raw',
  normalizedDir: 'normalized',
  status: 'done'
});

assert.equal(contract.retentionPolicy.expiresAt, defaultPolicy.expiresAt, 'snapshot contract should include derived retention deadline');
assert.equal(contract.retentionPolicy.pruneAutomatically, false, 'snapshot contract must not auto-prune raw data');
assert.equal(contract.retentionPolicy.remoteUpload, false, 'snapshot contract must keep retention local');
assert(contract.layers.some(layer => layer.key === 'raw_snapshot' && layer.shownByDefault === false), 'raw snapshots should not be shown by default');
assert.equal(contract.security.remoteUpload, false, 'crawler security policy must still block remote upload');

console.log('Crawler retention contract smoke passed.');
