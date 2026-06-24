
---

## Deep Metric Audit Correction

A deeper metric audit was attempted against `/api/tiktokshop-crawler/db`, but the script returned no metric-like objects because the crawler DB response does not expose Shop Overview UI metrics as simple `key/label/value/available` objects.

The Shop Overview UI metrics are built later in `app/business-analysis.mjs` through `buildShopCard(...)`.

Relevant metric builders found:

- `gmv`
- `orders`
- `impressions`
- `visitors`
- `refunds`
- `conversionRate`
- `aov`
- `storeScore`
- `sellerFaultRefundReturnRate`
- `tasksCompleted`
- `tasksRemaining`

Compass fallback cards found:

- `gmv`
- `orders`
- `visitors`
- `contentVideoGmv`
- `contentProductCardGmv`
- `contentLiveGmv`
- `affiliateTotalGmv`
- `sellerTotalGmv`

Important correction:

The first audit only showed `orders` and `visitors` missing because it inspected a small subset of cards returned by one cached overview path. The real UI has more missing cases, including:

- missing current metric value
- missing compare value
- missing Seller Center operational metrics
- missing task metrics
- missing health/score details

The app needs a metric coverage layer after card building, not only a crawler DB raw audit.

## Updated Phase 2.6B Direction

Do not start with automatic realtime/backfill yet.

First implement transparent metric coverage:

1. After `buildShopCard(...)`, normalize every card into a coverage object.
2. Each coverage object should identify:
   - metric key
   - label
   - group
   - current value availability
   - compare value availability
   - source
   - required source
   - missing reason
   - canBackfill
   - suggested action
3. Server responses should expose this coverage as safe metadata.
4. UI should show missing current value differently from missing compare value.
5. Realtime/cache/fallback status should be shown separately from card availability.

Current realtime state remains:

- Seller Center latest run is partial.
- `failureReason` is `cdp_unavailable`.
- `normalizedRows` is `0`.
- `retryable` is `true`.

Therefore, the immediate product gap is source/coverage transparency, not full auto-backfill.
