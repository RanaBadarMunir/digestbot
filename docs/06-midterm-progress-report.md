# Week 7 — Midterm Progress Report (Live Working Prototype Milestone Gate)

**DigestBot – Smart Bookmark-to-Weekly Newsletter Summarizer**
**Project ID:** PTUT-PRJ-096 · **Track:** 10. Productivity, Remote Work & Asynchronous Collaboration

**Live prototype:** https://digestbot-phi.vercel.app · **Health:** https://digestbot-phi.vercel.app/api/health
**Source:** https://github.com/RanaBadarMunir/digestbot (CI: lint · type-check · tests + coverage · audit · build)

---

## 1. Executive summary

The Week 7 gate asks for a live, working prototype. DigestBot is past that point: all five MVP features from
Week 1 are implemented and deployed to production on zero-cost infrastructure (Vercel + Neon serverless
PostgreSQL). The app has an automated suite of **117 passing tests** with **97.5 % line coverage** of the
domain logic and services, and the production health endpoint reports `{"status":"ok","db":"ok"}`.

Work planned for Weeks 8–11 (digest delivery, sharing, admin analytics, testing and security audit,
deployment) has also been completed ahead of schedule. The remaining weeks go to real user validation,
the optional AI and email keys, measuring the non-functional requirements on production, and the final report.

## 2. Progress against the 12-week plan

The plan below is the one this project's documents follow (SRS §1.1: design Weeks 3–4, implementation
Weeks 5–9, testing Week 10; Week 7 midterm gate; Week 12 final report).

| Week | Planned work | Deliverable | Status |
|---|---|---|---|
| 1 | Problem discovery, personas, MVP features | [docs/01](01-problem-discovery-and-personas.md) | ✅ Done — interview quotes are still illustrative (see §8) |
| 2 | Software Requirements Specification (IEEE 830): 20 FRs, 14 quantified NFRs, use cases | [docs/02](02-srs.md) | ✅ Done |
| 3 | 3-tier architecture, DFD L0/L1, system boundaries, cloud stack justification | [docs/03](03-architecture.md) | ✅ Done |
| 4 | ERD (6 tables, 3NF), index design, REST API contracts, 6 wireframes | [docs/04](04-database-api-wireframes.md) | ✅ Done |
| 5 | Implementation: auth (bcrypt + JWT), data layer (Drizzle + migrations), bookmark capture | Code: `src/server/auth.ts`, `src/db`, `src/server/bookmarks.ts` | ✅ Done |
| 6 | Implementation: safe fetch, extraction, AI / extractive summary, topic & priority, library UI | Code: `src/lib/extract.ts`, `summarize.ts`, `topics.ts`, `ai.ts` | ✅ Done |
| **7** | **Midterm gate: live working prototype, progress report, demo** | **This report, slide deck, live demo (§6)** | ✅ **Ready** |
| 8 | Weekly digest builder, scheduler (Vercel Cron), email delivery (Resend) | `src/lib/digest.ts`, `/api/cron/weekly`, `src/server/email.ts` | ✅ Done ahead |
| 9 | Shareable digests, settings (bookmarklet, import, export, delete account), admin portal | `/d/[token]`, `/app/settings`, `/admin` | ✅ Done ahead |
| 10 | Automated testing & security audit (OWASP Top 10) | [docs/05](05-testing-and-security-audit.md) | ✅ Done ahead |
| 11 | Production deployment and operations | Live on Vercel + Neon; migrations run in the build; daily cron registered | ✅ Done ahead |
| 12 | Final report, final presentation, handover | `docs/07` (to do) | ⏳ Pending |

### MVP feature status (Week 1 → today)

| # | MVP feature | Requirements | Status |
|---|---|---|---|
| 1 | One-click capture — paste URL, bookmarklet, `/save?url=` share page, browser bookmarks import (≤ 500) | FR-5, FR-10, FR-11 | ✅ Live |
| 2 | Extraction & summary — SSRF-safe fetch, readable text, TL;DR + 3 key points, reading time; Gemini or extractive fallback | FR-6, FR-7 | ✅ Live (extractive mode; no Gemini key set yet) |
| 3 | Smart triage — topic, tags, priority; search, filters, pagination, batch actions (≤ 100) | FR-7, FR-8, FR-9 | ✅ Live |
| 4 | Weekly digest — grouped by topic, intro, stats, up to 3 "worth a full read" picks; on demand and by cron | FR-12, FR-13, FR-14 | ✅ Live (email delivery needs a Resend key) |
| 5 | Shareable digest link — 24-byte random token, read-only public page, revocable | FR-15 | ✅ Live |
| — | Accounts, settings, data export, account deletion | FR-1–FR-4, FR-16 | ✅ Live |
| — | Admin portal — metrics, 30-day charts, RBAC, suspension, event log | FR-17–FR-19 | ✅ Live |
| — | Health endpoint | FR-20 | ✅ Live |

All 20 functional requirements in the SRS are implemented.

## 3. Architecture summary

DigestBot is a 3-tier web application in one Next.js 15 codebase (full diagrams in [docs/03](03-architecture.md)).

| Tier | What it is | Key technology |
|---|---|---|
| Client | Responsive React 19 UI: landing, auth, library, digests, settings, admin; bookmarklet and share URL | Next.js App Router, Tailwind CSS 4 |
| Application | Vercel serverless functions: middleware (route guard, security headers) → REST route handlers (Zod validation, Origin check, rate limits) → service layer (`src/server`) → pure domain logic (`src/lib`) | TypeScript, `jose` JWT, bcryptjs |
| Data | Neon serverless PostgreSQL in production; PGlite (Postgres in WebAssembly) locally and in tests | Drizzle ORM + SQL migrations |

**External services and fallbacks**

| Service | Use | If it fails or is not configured |
|---|---|---|
| Target websites / X oEmbed | Article HTML, tweet text | Bookmark kept with URL/title, marked *failed*, retry available |
| Google Gemini 2.5 Flash | Abstractive summary, topic, digest intro | Extractive summariser + rule-based topic + template intro |
| Resend | Digest email | Digest still available in-app |
| Vercel Cron (daily 07:00 UTC) | Weekly digest run for users whose weekday matches | User can generate on demand |

**Size of the codebase:** 10 pages, 23 REST route handlers, 6 database tables, 1 SQL migration,
about 5 600 lines of TypeScript across `src/` and `tests/`.

**Data model:** `users`, `bookmarks`, `digests`, `digest_items` (M:N), `events`, `rate_limits` — 3NF, with
indexes on `(user_id, created_at)`, `(user_id, status)`, a unique `(user_id, url_hash)` for duplicate detection
and a partial index on pending summaries for the cron backlog ([docs/04](04-database-api-wireframes.md)).

## 4. Testing and quality

| Measure | Result |
|---|---|
| Automated tests (Vitest, real Postgres via PGlite) | **117 passing** across 6 test files |
| Line coverage (`src/lib` + `src/server`) | **97.5 %** (statements 95.8 %, branches 86.9 %, functions 95.1 %) |
| Coverage gate | ≥ 70 % enforced in `vitest.config.ts`; CI fails below it |
| Type-check (`tsc --noEmit`, strict) | 0 errors |
| ESLint | 0 errors, 0 warnings |
| `npm audit --omit=dev` | 0 production vulnerabilities |
| CI (GitHub Actions) | Lint, type-check, tests + coverage, audit, production build on every push / PR — green |

| Test file | Focus | Tests |
|---|---|---|
| `url.test.ts` | URL normalisation, duplicate hashing, SSRF guard | 32 |
| `summarize.test.ts` | Extractive summary, topic classifier, priority | 12 |
| `digest.test.ts` | Ranking, grouping, picks, stats, email HTML escaping | 12 |
| `extract.test.ts` | HTML extraction, safe fetch, tweets, import, Gemini client | 20 |
| `auth-http.test.ts` | bcrypt, JWT, CSRF origin check, error mapping | 8 |
| `services.test.ts` | Integration: auth, multi-tenancy, digests, sharing, cron, rate limits, admin RBAC, account | 33 |

Security controls (OWASP Top 10 review in [docs/05](05-testing-and-security-audit.md)): bcrypt cost 12, JWT in
`HttpOnly`/`Secure`/`SameSite=Lax` cookies, per-user query scoping, Origin-header CSRF check, Zod validation,
parameterised SQL, SSRF guard re-checked on every redirect, rate limits, CSP and security headers, event log.

## 5. Screenshots (to capture for the submission)

Capture these from the live site at desktop width (and #3 and #6 also at phone width, ~375 px) and place them
in `docs/screenshots/` with the file names below.

| # | File name | Screen | What it should show |
|---|---|---|---|
| 1 | `01-landing.png` | `/` | Hero, 3-step "how it works", sample digest card |
| 2 | `02-signup.png` | `/signup` | Registration form |
| 3 | `03-library.png` | `/app` | Save box, stat tiles, filters, bookmark cards with TL;DR, key points, topic, priority |
| 4 | `04-bookmark-processing.png` | `/app` | A just-saved link moving from *pending* to summarised |
| 5 | `05-digest-list.png` | `/app/digests` | Digest list and "Generate" button |
| 6 | `06-digest-view.png` | `/app/digests/{id}` | Intro, stats, "worth a full read" picks, topic sections |
| 7 | `07-shared-digest.png` | `/d/{token}` (logged out) | Public read-only digest |
| 8 | `08-settings.png` | `/app/settings` | Digest weekday, bookmarklet, import, export, delete account |
| 9 | `09-admin.png` | `/admin` | Metric tiles, 30-day activity chart, summary-source and topic charts, users table |
| 10 | `10-health.png` | `/api/health` | `{"status":"ok","db":"ok", …}` |
| 11 | `11-ci.png` | GitHub → Actions | Green CI run |
| 12 | `12-coverage.png` | `coverage/index.html` | Coverage report |

## 6. Live demo — scripted end-to-end smoke test

Run against **https://digestbot-phi.vercel.app** in a fresh browser window. Use a new demo account created on
the day (e.g. `midterm-<date>@example.com`) so the demo starts from an empty library. For the admin step, log
in with the account listed in `ADMIN_EMAILS`. Expected total time: about 8 minutes.

**Before the panel arrives (5 min):**
- [ ] Open https://digestbot-phi.vercel.app/api/health → `"status":"ok","db":"ok"` (this also wakes the Neon database).
- [ ] Prepare 3–4 public article URLs from different topics (e.g. an engineering blog post, an AI article, a product/UX article). Avoid paywalled or JavaScript-only pages.
- [ ] Have the GitHub Actions page and `coverage/index.html` open in other tabs as backup evidence.
- [ ] Have the slide deck open on the "Demo flow" slide.

**Demo script:**

| # | Step | Action | Expected result | ✓ |
|---|---|---|---|---|
| 1 | Landing | Open `/` | Landing page loads; "Get started" visible | ☐ |
| 2 | Sign up | Get started → name, email, password `≥ 8 chars, letters + digits` | Redirected to the library, empty state | ☐ |
| 3 | Validation | (Optional) try a password like `short` | Field error, no account created | ☐ |
| 4 | Save | Paste article URL #1 → Save | Card appears at once with *pending*; within ~5 s shows title, TL;DR, 3 key points, topic, tags, reading time, priority | ☐ |
| 5 | Duplicate | Paste the same URL with `?utm_source=x` added | Toast "Already in your library"; no second card | ☐ |
| 6 | More links | Save URLs #2–#4 | Each is summarised; topic chips appear in the filter bar | ☐ |
| 7 | Triage | Search a word from a title; filter by a topic; select two → Mark read | List filters; stat tiles update; toast confirms | ☐ |
| 8 | Share page | Open `/save?url=<another article>` | Saved to the library (mobile share / bookmarklet path) | ☐ |
| 9 | Digest | Digests → "Generate this week’s digest now" | Digest with intro, stats (items, reading minutes, minutes saved), up to 3 picks, sections by topic | ☐ |
| 10 | Share | Toggle Share → copy link | Public URL `/d/<token>` shown | ☐ |
| 11 | Public view | Open the link in a private window (logged out) | Read-only digest renders | ☐ |
| 12 | Revoke | Toggle Share off → reload the private window | 404 — link no longer works | ☐ |
| 13 | Settings | Settings → change digest weekday; show bookmarklet and import; Export my data | Saved toast; JSON file downloads | ☐ |
| 14 | Security | In a logged-out window open `/app` | Redirected to login | ☐ |
| 15 | Admin | Log out → log in as the admin account → Admin | Metric tiles, 30-day chart, summary-source and topic charts, the new demo user in the users table, events (signup, login) in the event log | ☐ |
| 16 | Governance | Suspend the demo user; try to log in as them | Login refused (account suspended); reactivate afterwards | ☐ |
| 17 | Health | Open `/api/health` | `status: ok`, `db: ok` | ☐ |

**If something fails live:** a link that cannot be fetched is marked *failed* with a retry button — show this
as the designed fallback and use another URL. If the site is unreachable, show the screenshots in §5 and run
`npm run dev` locally (embedded PGlite, demo data via `npm run db:seed`).

## 7. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | Interview evidence in Week 1 is still illustrative, not from real users | High / High (assessment) | Run at least 5 interviews with the template in docs/01 §7 before the final report; replace quotes |
| R2 | No Gemini key yet, so summaries are extractive only | Certain / Medium | Extractive fallback works today; add a free Gemini key in Vercel env vars and re-summarise a few bookmarks to compare |
| R3 | No Resend key, so the cron does not send email | Certain / Medium | Digests are viewable in-app and shareable; add a free Resend key and verify one scheduled email |
| R4 | Vercel is not connected to GitHub; production deploys are run manually with the Vercel CLI | Medium / Low | CI still gates every push; deploy only from a green `main`; connect the Git integration when possible |
| R5 | Free-tier limits: one cron per day, Neon scale-to-zero cold start, Gemini quota | Medium / Low | Cron picks users whose weekday matches; open `/api/health` before demos; extractive fallback on quota errors |
| R6 | Some sites block fetching or need JavaScript | Medium / Low | Bookmark kept with URL/title, marked *failed*, retry; X uses oEmbed |
| R7 | Residual security risks from the audit: DNS rebinding window, CSP allows inline scripts | Low / Low | Documented in docs/05; nonce-based CSP is a planned improvement |
| R8 | NFR latency and Lighthouse targets (NFR-1–NFR-3) not yet measured on production | Medium / Medium | Measure and record in the final report (next steps) |

## 8. Next steps (Weeks 8–12)

1. **User validation** — interview at least 5 target users; replace the illustrative quotes in docs/01; record
   2–3 users trying the live app and note usability issues.
2. **Turn on optional services** — add `GEMINI_API_KEY` and `RESEND_API_KEY` in Vercel; verify AI summaries and
   one scheduled digest email end to end.
3. **Measure the NFRs on production** — p95 API latency (NFR-1/2), Lighthouse FCP (NFR-3), securityheaders.com
   scan (NFR-9); record results against the SRS targets.
4. **Deployment pipeline** — connect Vercel to the GitHub repository so `main` deploys automatically.
5. **Final deliverables (Week 12)** — final report (`docs/07`), screenshots, final presentation and handover.

## 9. Evidence index

| Evidence | Where |
|---|---|
| Live app / health | https://digestbot-phi.vercel.app · `/api/health` |
| Source and CI | https://github.com/RanaBadarMunir/digestbot → Actions |
| Requirements | [docs/02-srs.md](02-srs.md) |
| Architecture | [docs/03-architecture.md](03-architecture.md) |
| ERD and API | [docs/04-database-api-wireframes.md](04-database-api-wireframes.md) |
| Tests and security | [docs/05-testing-and-security-audit.md](05-testing-and-security-audit.md) |
| Coverage report | `npm run test:coverage` → `coverage/index.html` |
