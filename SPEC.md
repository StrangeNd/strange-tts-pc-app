# SPEC.md

## Product Identity

Product name: `Strange-tiktokshop-pc-app`

Domain: TikTok Shop operations on PC

Important rule: in this repository, `TTS` means **TikTok Shop**, not **Text-To-Speech**.

Do not add speech synthesis, voice, pitch, generated audio, audio preview, voice selector, speech speed controls, or any Text-To-Speech behavior unless a human explicitly requests an audio feature.

The product is a **local PC companion app** for TikTok Shop operations. It is not a public SaaS app.

---

## Target Users

The product serves two primary user groups:

1. Non-technical TikTok Shop owners.
2. TikTok Shop operations staff working inside an agency team that manages multiple TikTok Shops.

The product must prioritize:

* Simple local workflows.
* Clear shop separation.
* Safe multi-shop operations.
* Minimal technical setup.
* Clear business metrics.
* Clear missing-data display.
* Easy opening of Seller Center, Seller Ads, Compass, GMV Max, and extension tools from the correct local profile.

Users should not need technical knowledge to open the app, select the correct shop, open shop-specific sessions, run crawler actions, or read business metrics.

---

## Current Product Goal

Build and maintain a local PC companion app that helps a non-technical TikTok Shop operator and agency operations team:

* Open the app from desktop or script.
* Manage multiple shops through isolated local browser profiles.
* Open the original GMV Max extension dashboard.
* Open Seller Ads and Seller Center sessions with the correct logged-in shop profile.
* Prevent shop/profile/cookie mixing.
* Crawl TikTok Seller Center, Seller Ads, Compass, GMV Max, shop health, product score, and related data when allowed.
* Show crawled metrics clearly, with missing data visible instead of invented.
* Combine crawler data and uploaded XLSX/CSV/TSV/TXT files into business analysis.
* Support daily shop operations through simple local workflows.
* Support video downloading through the bundled extension inside each shop profile.
* Prepare for future Cloud Sync while using local-only sync/backup in the first phase.

The product is expected to be used from a Windows local folder, not directly from the WSL UNC path. The WSL repo is the development/mirror workspace for agents.

---

## Current Runtime Model

The repository contains:

* `app/`: local Node.js backend/server, launcher, app config, business analysis, crawler integration, runtime helpers.
* `public/`: local PC app shell UI.
* `extension/`: bundled extension/dashboard runtime copied from the original Strange TTS Solution extension.
* `scripts/`: build, smoke, package, security, crawler, and agent workflow scripts.
* `docs/`: product, architecture, harness, security, and workflow documents.
* `agents/`: Agent A/Agent B/orchestrator prompts and guardrails.
* `.github/workflows/agent-ci.yml`: PR/main CI workflow.

Production usage is expected from a Windows local folder.

The local app should support being opened by a desktop shortcut or script in a way that is convenient for non-technical users.

---

## Explicit Non-Goals

Do not build or reintroduce:

* Text-To-Speech features.
* Speech synthesis.
* Voice selector.
* Pitch/speed controls.
* Generated audio.
* Audio preview.
* Public SaaS behavior.
* Remote cloud sync without explicit approval.
* Payment/billing systems without explicit approval.
* Auth/admin/password systems without explicit approval.
* Production deployment automation without explicit approval.
* Cookie/session export in plaintext.
* Any behavior that bypasses platform permissions or unauthorized access controls.

---

## Current Accepted Behaviors

### Desktop/App Shell

User can open the local app.

App health is shown through `#healthPill`.

Main shell provides buttons for:

* Dashboard
* Seller Ads
* Checklist vận hành
* Phân tích KD
* TikTok Crawler
* Kế hoạch
* Cloud Sync
* AI Data, if still present, must be removed or treated as out of scope/external
* Hướng dẫn
* Tải video
* Xem sản phẩm toggle
* Cài đặt xem video
* Trạng thái runtime

Button IDs are important because `public/app.js` binds behavior by ID.

When UI shell is touched:

* Verify all bound IDs still exist in `public/index.html`.
* Verify no mojibake/replacement characters were introduced.
* Use Codex Browser, Chrome/Edge CDP, or a local app window when available.

---

## Multi-Shop Profile Model

Each active shop must be associated with one isolated local browser profile.

The app must prevent cookie/session mixing between shops. A known failure mode from older versions is opening Shop A but landing in Shop B because cookies or browser state were mixed. This must be treated as a core product risk.

Each shop profile should support:

* Shop name
* Shop avatar
* Login note
* Ads account ID
* Seller Center entry URL
* Seller Ads entry URL
* Compass entry URL
* GMV Max dashboard entry URL
* Shop health status
* Product score status
* Human verification status for whether the opened session matches the intended shop

The app does not need to track “last opened shop” as a core requirement.

The app must show the currently selected shop/profile clearly before opening shop-specific pages.

---

## Shop Mismatch Warning

When opening Seller Center, Seller Ads, GMV Max, Compass, crawler flows, video downloader flows, or extension dashboard flows, the app must warn the user if the selected shop/profile may not match the active browser session.

The app should provide a simple confirmation flow:

* Correct shop
* Wrong shop
* Not logged in
* Needs re-login
* Needs session restore

This confirmation must be stored as local metadata only.

It must not expose:

* Cookies
* Tokens
* Credentials
* Authorization headers
* Machine IDs
* License keys
* Private browser state

---

## Checklist Vận Hành

A local-only daily TikTok Shop operations checklist exists.

State is stored in browser `localStorage`.

State is scoped by:

* Selected shop/profile
* Local date

Reset clears today's checklist only.

No backend or database is used for this feature unless a future PR explicitly changes the architecture.

Checklist behavior must remain simple enough for non-technical shop operators.

---

## Business Analysis

Business analysis combines uploaded files and crawler data.

Current main branch still depends on `xlsx` unless PR #7 has been merged.

PR #7 replaces direct vulnerable `xlsx` usage with `exceljs` and a small CSV/TSV parser.

After PR #7, supported upload formats should be:

* `.xlsx`
* `.csv`
* `.tsv`
* `.txt`

Legacy `.xls` should not be advertised unless a supported parser is added.

Business analysis must:

* Preserve missing metrics as missing.
* Never treat missing data as zero unless the source explicitly provides zero.
* Show source, timestamp, and status for each metric where possible.
* Distinguish uploaded-file data from crawler data.
* Distinguish raw crawler data from normalized metrics.
* Show warnings when metrics cannot be computed.

---

## Core Business Metrics

The product should prioritize the following metrics:

* GMV
* Ads Spend

  * Ads Credit
  * Credit
  * Cash
* ROI
* Orders
* Refund/cancel
* SKU performance
* Livestream performance
* Video performance
* Product affiliate performance
* Product Score
* Shop Score
* Shop violations

Ads Spend should show separate spend components from:

`http://ads.tiktok.com/i18n/account/payment?aadvid=[ID_Ads_Account]`

The app must make it visible whether Ads Spend comes from:

* Ads Credit
* Credit
* Cash
* Other visible account payment/spend fields

If a value is not available, it must be shown as missing, not invented.

---

## Shop Score Display

Shop Score should expose its components clearly.

### Product Satisfaction

Formula:

`(5 - negative_review_rate_60d - seller_fault_return_refund_rate_60d) * 70%`

Required source metrics:

* Negative review rate in 60 days
* Return/refund rate due to seller fault in 60 days

The implementation must clearly define whether rates are represented as percentages, decimals, or normalized values before calculating.

### Fulfillment and Logistics

Formula:

`(((fast_shipping_rate_30d * 5) / 100) - seller_fault_cancel_rate_30d) * 15%`

Required source metrics:

* Fast shipping rate in 30 days
* Cancellation rate due to seller fault in 30 days

The implementation must clearly define rate units before calculating.

### Customer Service

Customer Service currently has no complete formula.

Display component metrics only:

* Seller after-sales handling time in 60 days
* 12-hour response rate in 30 days

If source data is missing, the score must show missing dependencies instead of inventing a value.

---

## Shop Violations

Shop violations should support the following appeal/status tags:

* Chưa khiếu nại
* Khiếu nại không thành công
* Thành công
* Không cần khiếu nại

Violation data must show:

* Violation title/type when available
* Status tag
* Source
* Timestamp
* Missing fields as missing

---

## TikTok Crawler

Crawler is intended to use an already-authenticated local browser profile.

Crawler actions are allowed in the following modes:

1. Automatic local crawl when the user opens a shop profile and manually uses Seller Center, Seller Ads, Compass, GMV Max, product score, shop health, or related TikTok Shop pages.
2. Manual crawl by button when the user has not opened Seller Center or needs fresh realtime data.
3. Optional scheduled local daily crawl controlled by an on/off toggle.

Crawler scope may include:

* Seller Center
* Seller Ads
* Compass
* GMV Max
* Shop health
* Product score
* Shop score
* Shop violations
* Ads payment/spend pages
* SKU performance
* Livestream performance
* Video performance
* Product affiliate performance

Realtime crawler actions must perform a fresh crawl unless the UI clearly says cached data is being used.

Crawler validation is difficult without authenticated local profiles. When full validation is not possible, PR reports must clearly state what was validated and what remains manual.

---

## Crawler Storage Model

The crawler should store both raw snapshots and normalized metrics.

### Raw Snapshots

Raw snapshots:

* Are used for debugging, parser improvement, auditing, and recovery when TikTok changes UI/API structure.
* Must be stored separately from normalized metrics.
* Must be scrubbed so cookies, tokens, credentials, machine IDs, license keys, authorization headers, and other secrets are not saved or exposed.
* Should have a local retention policy.
* Should be compressed if large.
* Should not be shown by default to non-technical users.
* Must not be uploaded remotely unless a future approved Cloud Sync feature explicitly allows safe upload.

### Normalized Metrics

Normalized metrics:

* Are the primary data source for dashboards and business analysis.
* Must include source, timestamp, shop/profile ID, and status.
* Must represent missing data as missing, not as zero.
* Must not invent unavailable metrics.

### Derived Metrics

Derived metrics:

* Must declare their formulas.
* Must expose missing dependencies.
* Must show unavailable/missing status if required source metrics are missing.
* Must be recomputable from normalized metrics.

Recommended data layering:

1. Raw snapshot
2. Parsed source data
3. Normalized metrics
4. Derived metrics
5. Dashboard/report view

---

## Authorized Local Session Restore

Session restore is a high-risk capability and requires explicit human approval before implementation.

The preferred product wording is:

`Authorized Local Session Restore`

Avoid wording such as:

`login bypass`

If implemented, the feature must only restore sessions for shops/profiles that the user or agency is authorized to operate and that were previously logged in locally by the user/team.

Requirements:

* Store session material only locally.
* Encrypt sensitive session material at rest.
* Never log cookies, tokens, credentials, machine IDs, license keys, authorization headers, or private session payloads.
* Never send session material to cloud services.
* Never export plain text cookies.
* Provide a user-facing enable/disable control.
* Provide a local audit trail with metadata only, such as shop ID, timestamp, and action type.
* Provide a kill switch.
* Do not use session restore to bypass platform permissions, access controls, or unauthorized login requirements.
* Do not use session restore for shops outside the user's/team's authorized operations.

This feature must be implemented in a dedicated PR, not mixed with normal UI/product work.

Required proof for any session restore PR:

* Secret scrubbing test.
* No cookie/token appears in logs.
* No cookie/token appears in PR reports.
* No cookie/token appears in raw crawler reports.
* No plaintext export.
* Clear local encryption approach.
* Clear user consent/on-off behavior.
* Human approval recorded in task intake or PR report.

---

## Cloud Sync Direction

Cloud Sync remains part of the product direction, but the first implementation phase should be local-only.

Phase 0 behavior:

* Local backup
* Local sync/export/import
* No remote cloud upload
* No SaaS account system
* No production backend
* No billing/payment/auth system

The local implementation should be designed so it can later be replaced by real cloud sync after explicit human approval.

Recommended UI wording for Phase 0:

`Đồng bộ local / Sao lưu dữ liệu — Cloud thật sẽ được phát triển sau.`

Cloud Sync must not introduce remote storage, account login, production backend, payment, or billing without explicit human approval.

---

## AI Data Scope

AI Data is out of scope for this PC companion app because it exists as a separate webapp/module.

The PC app must not duplicate the AI Data module.

If needed in the future, the PC app may link to the separate AI Data webapp through an explicitly approved integration.

If the AI Data button still exists in the app shell, a future PR should either:

* Remove it, or
* Mark it as external/out-of-scope, or
* Replace it with a link to the separate module after explicit approval.

---

## Video Downloader Scope

Video downloader remains in scope because it is part of the bundled extension installed inside each shop profile.

Supported behavior:

* Download by operator-provided URL.
* Download from Ads/product management UI where the authorized operator can already view the video.
* Keep downloader behavior scoped to the active shop/profile.
* Support the existing extension-based video downloader workflow.

The downloader must not:

* Bypass access controls.
* Bypass DRM.
* Download private content the operator cannot already view.
* Circumvent platform permissions.
* Mix data across shop profiles.

---

## Security and Licensing Direction

The product should choose a security model that balances:

* Strong protection against cracking.
* Strong protection against license bypass.
* Protection against intellectual property theft.
* Convenience for non-technical users.
* Local-first usage on Windows.
* No unnecessary SaaS dependency in the first production phase.

High-risk areas requiring explicit human approval:

* License activation/enforcement.
* Cookie/session restore.
* Cookie import/export behavior.
* Auth/admin/password behavior.
* Payment/billing/commercial key systems.
* Database schema migrations or destructive data operations.
* Deployment/release automation.
* Production infrastructure.
* User data deletion/export/retention.

Medium-risk areas:

* Spreadsheet parsing and business analysis calculations.
* Crawler selectors/API discovery.
* Cache behavior.
* Desktop/window runtime behavior.
* Data normalization.
* Local backup/sync/export/import.

Low-risk areas:

* UI copy/layout.
* Docs.
* Tests/smoke scripts.
* Local-only browser behavior using `localStorage`.

Logs/reports must not expose:

* Cookies
* Tokens
* Credentials
* Machine IDs
* License keys
* Authorization headers
* `.env` values
* Payment/billing secrets
* Private session data

---

## Current GitHub/PR State

This section is a handoff snapshot, not an authoritative live source. Before
answering "what next?" or starting a new task, verify the current state with:

```sh
git fetch --all --prune
git log --oneline --decorate --graph --all -20
git status --short --branch
```

If `gh` is available, also check current PR state:

```sh
gh pr list --state all --limit 20
```

If `gh` is unavailable, check GitHub in the browser. Do not assume older
`SPEC.md` roadmap entries are still current when newer PRs have merged.

Known recent PR state as of 2026-06-19:

### PR #7

Branch:

`ai-agent/fix-xlsx-audit`

Purpose:

Fixes high severity `xlsx` audit issue.

Status:

Merged into `main` on 2026-06-18.

After PR #7:

* Direct vulnerable `xlsx` dependency should be replaced.
* Supported upload formats should be `.xlsx`, `.csv`, `.tsv`, and `.txt`.
* Legacy `.xls` should not be advertised unless a supported parser is added.

### PR #8

Branch:

`ai-agent/clarify-pc-app-shell`

Purpose:

Improves the PC app shell copy/UI for non-technical operators.

Status:

Still open/stale as of the 2026-06-19 handoff. It is not the latest merged
product baseline and must not be treated as the blocker for current product
work unless a human explicitly revives it.

### PR #9

Branch:

`ai-agent/adopt-current-spec`

Purpose:

Adopts the current repository SPEC for agent handoff.

Status:

Merged into `main`.

### PR #10

Branch:

`ai-agent/crawler-data-status-clarity`

Purpose:

Clarifies crawler data status in the local UI.

Status:

Merged into `main`.

### PR #11

Branch:

`ai-agent/shop-overview-operations-dashboard`

Purpose:

Adds a read-only shop overview operations dashboard and `/api/business/shop-overview`.

Status:

Merged into `main` on 2026-06-18.

After PR #11:

* The Dashboard is the shop operations overview.
* The app can show selected profile context, data source/status, last crawl
  timestamp, KPI cards, metric-source table, missing states, and next-action
  buttons.
* The next in-progress branch is expected to build on this overview, not restart
  from the older PR #7/#8 sequence.

### Current Local State When This Spec Was Written

Branch:

`ai-agent/shop-health-score-center`

Current branch is based on `main` after PR #11.

Working tree may contain in-progress Shop Health / Shop Score Center changes in:

* `app/business-analysis.mjs`
* `public/app.js`
* `public/styles.css`
* `docs/TEST_MATRIX.md`
* `docs/stories/US-003-shop-health-score-center.md`

Do not discard or overwrite these local changes. Finish, stash, or intentionally
separate them before switching tasks.

---

## Harness Status

The repository uses a lightweight agent harness.

Core files:

* `AGENTS.md`
* `agents/guardrails.md`
* `agents/risk-policy.md`
* `docs/HARNESS.md`
* `docs/FEATURE_INTAKE.md`
* `docs/ARCHITECTURE.md`
* `docs/TEST_MATRIX.md`
* `docs/product/PRODUCT_CONTRACT.md`
* `docs/decisions/`
* `docs/stories/`
* `docs/templates/`

Current assessment:

* H1 policy/scaffolding: achieved.
* H2 durable state: partially present but not fully active.
* H3-H5 self-improvement: designed in docs, not proven as a repeated operating loop yet.

Important detail:

* `scripts/bin/harness-cli` exists and reports version `0.1.10`.
* `scripts/schema/001-init.sql` exists.
* `harness.db` was not present when this spec was written.
* Therefore `harness-cli query/audit/propose` currently fails until the durable database is initialized.

To activate the durable layer:

```sh
scripts/bin/harness-cli init
scripts/bin/harness-cli migrate
scripts/bin/harness-cli import brownfield
scripts/bin/harness-cli audit
```

Do this in a dedicated branch/PR because it changes harness operating state and may require committing docs/schema files first.

Recommended branch:

`ai-agent/harness-durable-stabilization`

---

## Agent Self-Improvement Policy

H3-H5 self-improvement is designed but not yet proven as a repeated operating loop.

Self-improvement proposals may be written as docs/stories only.

Agents must not implement self-improvement changes without a dedicated human-approved task.

Agents must not use self-improvement as a reason to bypass product scope, risk lanes, validation, or human approval requirements.

---

## Agent Operating Rules

Every new agent must:

1. Read `SPEC.md`.
2. Read `AGENTS.md`.
3. Read `agents/guardrails.md`.
4. Read `agents/risk-policy.md`.
5. Classify the task using `docs/FEATURE_INTAKE.md`.
6. Check product behavior in `docs/product/PRODUCT_CONTRACT.md`.
7. Check boundaries in `docs/ARCHITECTURE.md`.
8. Check proof requirements in `docs/TEST_MATRIX.md`.
9. Work on a non-main branch.
10. Never push directly to main.
11. Never merge PRs automatically.
12. Never deploy production.
13. Never expose or modify secrets, cookies, credentials, license keys, machine IDs, `.env` files, auth, payment, billing, permissions, database migrations, or deployment config without explicit human approval.

For normal product changes:

* Create a task intake in the PR report before coding.
* Agent B must review the intake before Agent A implements.
* Agent B must reject if risk lane, validation proof, domain compliance, or test matrix updates are missing.
* Repeat up to 5 loops.
* Run required validation before opening the PR.

Agent B must reject if:

* The task confuses TikTok Shop with Text-To-Speech.
* The task adds speech/audio features without explicit human request.
* The task touches high-risk areas without explicit approval.
* The task lacks a validation plan.
* The task changes product behavior without updating docs/test matrix.
* The task exposes secrets or sensitive runtime data.
* The task mixes unrelated harness/product changes in one PR.

---

## Branch and PR Naming Convention

Use:

`ai-agent/<area>-<short-task>`

Examples:

* `ai-agent/shop-profile-session-safety`
* `ai-agent/authorized-local-session-restore`
* `ai-agent/crawler-snapshot-contract`
* `ai-agent/shop-business-metrics-dashboard`
* `ai-agent/profile-video-downloader-stabilization`
* `ai-agent/ui-qa-harness`
* `ai-agent/readme-domain-cleanup`
* `ai-agent/harness-durable-stabilization`

Do not work directly on `main`.

Do not merge PRs automatically.

---

## Validation Baseline

Common checks:

```sh
node --check public/app.js
node --check scripts/smoke.mjs
./scripts/agent-healthcheck.sh
```

When business analysis/spreadsheet parsing is touched:

```sh
node --check app/business-analysis.mjs
node --check scripts/spreadsheet-smoke.mjs
node scripts/spreadsheet-smoke.mjs
npm audit --audit-level=high
```

When UI shell is touched:

* Verify all bound IDs still exist in `public/index.html`.
* Verify no mojibake/replacement characters were introduced.
* Use Codex Browser, Chrome/Edge CDP, or a local app window when available.

When crawler behavior is touched:

* Validate syntax.
* Validate no secrets are logged.
* Validate raw/normalized storage separation.
* Validate missing metrics remain missing.
* Validate realtime actions do fresh crawl unless UI clearly says cached.
* Document what could not be validated without authenticated profiles.

When session/cookie restore is touched:

* Require explicit human approval.
* Require dedicated PR.
* Verify no cookies/tokens/secrets are logged.
* Verify no plaintext cookie export.
* Verify local encryption behavior.
* Verify user-facing enable/disable control.
* Verify audit metadata contains no sensitive session material.

When video downloader behavior is touched:

* Verify behavior remains scoped to active shop/profile.
* Verify no access-control bypass is added.
* Verify no DRM/private-content bypass is added.
* Verify no profile mixing is introduced.

---

## Known Gaps

* README.md still contains older wording such as `Strange TTS PC App`.
* Some files still contain mojibake from earlier encoding history.
* Browser/UI QA is still mostly manual.
* HB-001 proposes a reusable local UI QA harness.
* Crawler validation is difficult without authenticated local profiles.
* Durable harness DB is not initialized.
* Several harness docs/schema files are untracked and need a dedicated review.
* `docs/TEST_MATRIX.md` is still manually maintained and can drift from PR reports.
* AI Data exists as a separate module and should be removed or marked out of scope in this PC app.
* Cloud Sync is currently product direction only; phase 0 should be local backup/sync.
* Authorized local session restore is desired but high-risk and must be handled in a dedicated approved PR.

---

## Recommended Next Work

### P0 — Domain, Security, and Current PRs

1. Verify the latest merged PR and open PR state before choosing next work.
2. Pull `main`.
3. Verify the current baseline:

```sh
npm audit --audit-level=high
./scripts/agent-healthcheck.sh
```

4. Treat PR #11 as the current merged product baseline unless newer PRs have merged.
5. If local work exists on `ai-agent/shop-health-score-center`, finish or park that branch before starting another feature.
6. Clean README/domain wording when doing a dedicated docs cleanup.
7. Ensure all docs preserve the rule: `TTS = TikTok Shop, not Text-To-Speech`.
8. Remove or mark AI Data as out-of-scope/external in a scoped product/UI PR.
9. Do not mix harness stabilization with product feature PRs.

### P1 — Shop Profile and Session Safety

Recommended branch:

`ai-agent/shop-profile-session-safety`

Scope:

* Each shop has a dedicated browser profile.
* Metadata includes:

  * Shop name
  * Avatar
  * Login note
  * Ads account ID
  * Seller Center URL
  * Seller Ads URL
  * Compass URL
  * GMV Max URL
  * Shop health status
* Show selected shop/profile clearly.
* Warn when shop/profile may not match.
* Add human confirmation:

  * Correct shop
  * Wrong shop
  * Not logged in
  * Needs re-login
  * Needs session restore
* Do not implement session restore in this PR.
* Do not expose cookies/tokens/secrets.

### P2 — Authorized Local Session Restore

Recommended branch:

`ai-agent/authorized-local-session-restore`

Scope:

* Restore session only for authorized local shop profiles.
* Store session material locally.
* Encrypt sensitive session material.
* Never log cookie/token/credential data.
* Never export plaintext cookies.
* Add user-facing toggle.
* Add kill switch.
* Add audit metadata without secrets.
* Require explicit human approval.

### P3 — Crawler Foundation

Recommended branch:

`ai-agent/crawler-snapshot-contract`

Scope:

* Manual crawl by button.
* Automatic local crawl when user opens and uses shop profile pages.
* Schedule local daily crawl by toggle.
* Raw snapshot + normalized metrics.
* Raw snapshot scrub + retention.
* Source/status/timestamp on metrics.
* Fresh realtime crawl unless UI says cached.
* No secrets in logs/reports.

### P4 — Business Metrics Dashboard

Recommended branch:

`ai-agent/shop-business-metrics-dashboard`

Scope metrics:

* GMV
* Ads Spend

  * Ads Credit
  * Credit
  * Cash
* ROI
* Orders
* Refund/cancel
* SKU performance
* Livestream performance
* Video performance
* Product affiliate performance
* Product Score
* Shop Score
* Violation status

### P5 — Video Downloader Stabilization

Recommended branch:

`ai-agent/profile-video-downloader-stabilization`

Scope:

* Downloader runs inside extension/profile.
* Download by URL.
* Download from Ads/product management UI.
* Do not bypass private/DRM/access control.
* Do not mix shop profiles.

### P6 — UI QA Harness

Recommended branch:

`ai-agent/ui-qa-harness`

Scope:

* Verify all important button IDs exist.
* Verify `public/app.js` bindings.
* Verify `#healthPill`.
* Verify no mojibake/replacement characters.
* Add local UI smoke harness where possible.
* Keep test simple and reusable.

### P7 — Durable Harness Stabilization

Recommended branch:

`ai-agent/harness-durable-stabilization`

Scope:

* Review untracked harness docs/schema files.
* Commit intended harness docs/schema only.
* Initialize/migrate/import durable harness DB.
* Run:

```sh
scripts/bin/harness-cli audit
```

* Do not mix with product features.

---

## Definition Of Ready For A New Agent

A new agent is ready to continue when:

* `main` is pulled and clean.
* The latest merged PR and currently open PRs are known from GitHub or `gh`.
* The agent has compared the live PR/git state against this `SPEC.md` snapshot and adjusted next-step advice accordingly.
* Untracked harness docs are either committed in a dedicated PR or intentionally left untouched.
* The agent has read:

  * `SPEC.md`
  * `AGENTS.md`
  * `agents/guardrails.md`
  * `agents/risk-policy.md`
  * `docs/FEATURE_INTAKE.md`
  * `docs/product/PRODUCT_CONTRACT.md`
  * `docs/ARCHITECTURE.md`
  * `docs/TEST_MATRIX.md`
* The next task has a written intake with:

  * Task name
  * User value
  * Scope
  * Non-scope
  * Risk lane
  * Affected files
  * Acceptance criteria
  * Validation plan

---

## Definition Of Done For Future PRs

A PR is not done until:

* It is on a non-main branch.
* It has a task/PR report.
* Agent B approved intake before implementation.
* Agent B reviewed implementation.
* Rejections are recorded in `BUG_REPORT.md` or the PR report.
* Required checks pass.
* `docs/TEST_MATRIX.md` or durable story records are updated when behavior changes.
* Product domain rule is preserved.
* No secrets or high-risk areas are touched without explicit approval.
* No Text-To-Speech behavior is added unless explicitly requested by a human.
* Missing data remains visible instead of invented.
* Shop/profile separation is preserved.
* PR is opened into `main` but not merged by the agent.

---

## Immediate Recommended Next Task

After PR #11 is merged and `main` is current, the next in-progress product task is:

`ai-agent/shop-health-score-center`

Reason:

PR #11 added the shop overview operations dashboard. The next logical slice is to expose Shop Health / Shop Score detail from the same local, read-only, missing-data-safe foundation.

This PR should build the foundation for:

* Shop Score component visibility.
* Missing dependency display for health formulas.
* Shop violation status display.
* Source/status/timestamp clarity for health data.
* Dashboard-to-health drilldown without inventing missing metrics.

It must not implement cookie/session restore, auth, payment, billing, license enforcement, production deployment, database migrations, or raw session/cookie handling.

The later shop/profile safety task remains important:

`ai-agent/shop-profile-session-safety`

Start that task only after the current Shop Health branch is finished, parked, or explicitly superseded.
