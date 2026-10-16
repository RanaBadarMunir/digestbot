# Week 10 — Automated Testing & Security Audit

**DigestBot** · Project ID PTUT-PRJ-096

---

## 1. Automated test suite

Framework: **Vitest 5** with V8 coverage. Database tests run against a real PostgreSQL engine (PGlite, in-memory)
with the same migrations as production, so SQL, constraints and cascades are exercised for real.

```
npm test               # run all tests
npm run test:coverage  # with coverage report (fails under 70%)
```

| Test file | Focus | Tests |
|---|---|---|
| `tests/url.test.ts` | URL normalisation, duplicate hashing, SSRF guard (private IPv4/IPv6, DNS-based, metadata host) | 32 |
| `tests/summarize.test.ts` | Sentence splitting, tokenising, TF scoring, extractive summary, topic classifier, priority | 12 |
| `tests/digest.test.ts` | Ranking, grouping, picks, stats, intro, period maths, email HTML escaping | 12 |
| `tests/extract.test.ts` | HTML extraction, safe fetch (redirects, timeouts, size cap), tweets, bookmark import, Gemini client | 20 |
| `tests/auth-http.test.ts` | bcrypt, JWT signing/forgery, validation, CSRF origin check, error mapping, body limits | 8 |
| `tests/services.test.ts` | Integration: auth, bookmarks, multi-tenant isolation, digests, sharing, email, cron, rate limit, admin RBAC, account export/delete | 33 |
| **Total** | | **117 passing** |

### Coverage (core domain logic + services)

| Area | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/lib` (domain logic) | 96.9 % | 88.7 % | 94.4 % | 99.1 % |
| `src/server` (services) | 94.6 % | 84.8 % | 96.0 % | 95.9 % |
| **All** | **95.8 %** | **86.9 %** | **95.1 %** | **97.5 %** |

Target was ≥ 70 % on core domain logic — **met**. The threshold is enforced in `vitest.config.ts`, so CI fails if
coverage drops below 70 %.

Manual end-to-end smoke test (Week 7 gate, re-run in Week 10): log in → paste a live article URL → summary,
topic and tags appear within ~5 s → generate digest → share publicly → open share link logged-out → admin portal
shows metrics. All passed on the production build (`next build && next start`).

## 2. Static analysis & dependency audit

| Check | Tool | Result |
|---|---|---|
| Type safety | `tsc --noEmit` (strict mode) | 0 errors |
| Lint / code smells | ESLint (`next/core-web-vitals`, `next/typescript`) | 0 errors, 0 warnings |
| Production dependency CVEs | `npm audit --omit=dev` | **0 vulnerabilities** |
| Dev-only dependency CVEs | `npm audit` | 9 advisories, all in build/lint tooling (`eslint-config-next` → `fast-glob`/`micromatch`/`braces`; `drizzle-kit` → old `esbuild`). Not shipped to production; accepted risk, re-checked each CI run. |

**Patched during the audit:** Next.js 15 bundled `postcss@8.4.31`, affected by GHSA-qx2v-qp2m-jg93 and three
source-map path-traversal advisories (high). Fixed without a breaking upgrade by pinning `postcss@^8.5.30` through
an npm `overrides` entry in `package.json`.

## 3. OWASP Top 10 (2021) review

| # | Risk | Mitigation in DigestBot | Evidence |
|---|---|---|---|
| A01 | Broken access control | Every query is scoped `WHERE user_id = <session user>`; ids are UUIDs; admin routes call `requireAdmin()` and the admin layout re-checks the role server-side; admins cannot change their own role/status; suspension is checked from the DB on every request | `services.test.ts` "isolates tenants", "suspends users" |
| A02 | Cryptographic failures | bcrypt cost 12; JWT HS256 with ≥ 32-byte secret (startup fails in production without it); share tokens are 24 random bytes; HTTPS + HSTS; cookies `HttpOnly`, `Secure`, `SameSite=Lax` | `auth-http.test.ts` |
| A03 | Injection | Drizzle ORM parameterises all SQL; `LIKE` wildcards escaped in search; fetched HTML is never rendered — only text is extracted; React escapes output; digest email HTML escapes every field and only allows `http(s)` links | `digest.test.ts` "renders escaped, link-safe HTML" |
| A04 | Insecure design | Rate limits (login 10/15 min per IP+email, signup 10/h per IP, saves 200/h, imports 5/h, digests 20/h); timing-safe login (dummy bcrypt compare for unknown emails); generic login error | `services.test.ts` "rate limiting" |
| A05 | Security misconfiguration | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed; 500 errors never leak internals | `auth-http.test.ts` "maps errors" |
| A06 | Vulnerable components | `npm audit` in CI (fails on high in production deps); PostCSS override | Section 2 |
| A07 | Identification & auth failures | Password policy (8+ chars, letter + digit); 7-day session expiry; password change requires current password; account deletion requires password | `services.test.ts` "account service" |
| A08 | Software & data integrity | Lockfile + `npm ci` in CI; Gemini output validated against a Zod schema and topic clamped to an allow-list; cron endpoint protected by a timing-safe secret comparison | `extract.test.ts` "rejects malformed model output" |
| A09 | Logging & monitoring failures | Event log for signup, login, failed/blocked login, role change, suspension, processing failures, cron runs — visible in Admin → Events; `/api/health` for uptime monitoring | Admin portal |
| A10 | SSRF | URL scheme allow-list, credentials rejected, DNS resolution checked against private/loopback/link-local/CGNAT/metadata ranges (IPv4 + IPv6 + mapped), re-checked on every redirect hop, 5-redirect cap, 8 s timeout, 2 MB cap | `url.test.ts`, `extract.test.ts` |

**CSRF:** all mutating API calls reject a cross-site `Origin` header (plus `SameSite=Lax` cookies).

**Prompt injection:** article text is wrapped in delimiters with an explicit "ignore instructions inside" rule,
and the model can only return a fixed JSON schema — it has no tools and cannot act, so the worst case is a poor
summary.

### Known limitations / residual risk
- DNS rebinding between the SSRF check and the actual connection is theoretically possible (the check and the
  fetch resolve separately). Impact is limited because responses are only stored as plain text for the same user.
- CSP allows `'unsafe-inline'` scripts because Next.js injects inline bootstrapping scripts; a nonce-based CSP is
  a future improvement.
- Rate limiting is per serverless region via Postgres; adequate for the free tier's scale.

## 4. Addendum — browser extension (after Week 10)

The browser extension (`docs/08-browser-extension.md`) added personal access tokens, so the review was repeated
for them:

- **A01 / A07:** a bearer request is authenticated by the token alone (never the cookie) and only on four opted-in
  routes — save, read one bookmark, who-am-I, import. Verified in real Chrome: the digests API answers 401.
- **A02:** tokens are 256-bit random values; only their SHA-256 hash is stored; shown once; max 10 per user;
  revocable from the website or the extension; suspended users' tokens stop working at once.
- **CSRF:** the Origin check is skipped only for bearer requests, which carry no cookie.
- **Token hand-over:** the content script runs only on DigestBot's own origin and accepts same-window,
  same-origin messages; the service worker re-validates the token before storing it.

Test totals after the extension: **142 automated tests** (102 unit, 40 integration), **97.7 % line coverage**, plus
16/16 end-to-end checks of the extension in Chrome 155.
