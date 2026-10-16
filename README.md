# DigestBot — Smart Bookmark-to-Weekly Newsletter Summarizer

> Save articles, tweets and technical blogs in one click. DigestBot reads them, summarises each with AI, and
> sends you one five-minute digest every week.

**Project ID:** PTUT-PRJ-096 · **Track:** 10. Productivity, Remote Work & Asynchronous Collaboration

**Live app:** https://digestbot-phi.vercel.app · **Health:** https://digestbot-phi.vercel.app/api/health

## Features
- **One-click capture** — paste a link, use the bookmarklet, share to `/save?url=…` from mobile, or import your browser's bookmarks file (up to 500 links).
- **Automatic summaries** — each page is fetched safely, its readable text extracted, and summarised into a TL;DR + 3 key points with **Google Gemini**, or an offline extractive summariser when no AI key is set.
- **Smart triage** — topic, tags, reading time and priority; search, filters and batch actions.
- **Weekly digest** — compiled automatically on your chosen weekday (Vercel Cron), grouped by topic with "worth a full read" picks; view in-app or by email (Resend).
- **Shareable digests** — publish a read-only link for your team; revoke any time.
- **Admin portal** — RBAC, user suspension, 30-day activity charts, summary-source and topic analytics, audit log.
- **Security** — bcrypt, JWT HTTP-only sessions, CSRF origin checks, SSRF-safe fetching, rate limits, CSP. See [docs/05](docs/05-testing-and-security-audit.md).

## Tech stack
Next.js 15 (App Router, React 19, TypeScript) · Tailwind CSS 4 · Drizzle ORM · **Neon serverless PostgreSQL** (production) / PGlite (local & tests) · Gemini 2.5 Flash · Resend · Vitest · GitHub Actions · Vercel.

## Run locally
```bash
npm install
cp .env.example .env.local     # AUTH_SECRET is optional locally
npm run db:seed                # demo@digestbot.app / digest-demo-1
npm run dev                    # http://localhost:3000
```
No database setup is needed locally: without `DATABASE_URL` the app runs an embedded PostgreSQL (PGlite) in `.data/` and migrates it on start.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` / `npm run test:coverage` | Vitest (117 tests, coverage gate 70 %) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:generate` | New SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (runs automatically in the Vercel build) |
| `npm run db:seed` | Demo user and bookmarks |

## Deploy (zero cost)
1. Import the GitHub repo in Vercel.
2. Vercel → Storage → **Create Database → Neon** (free) and connect it to the project — this sets `DATABASE_URL`.
3. Add environment variables: `AUTH_SECRET` (32+ random chars), `CRON_SECRET`, `ADMIN_EMAILS`, `APP_URL`; optionally `GEMINI_API_KEY` and `RESEND_API_KEY`.
4. Deploy. The build runs migrations (`npm run vercel-build`); `vercel.json` registers the daily cron at 07:00 UTC.
5. Check `https://<your-app>/api/health` returns `{"status":"ok","db":"ok"}`.

## Project structure
```
src/
  app/            pages (landing, auth, /app, /admin, /d/[token], /save) and REST API routes (/api/**)
  components/     UI (library, digest view, settings, admin, charts)
  server/         services: auth, bookmarks, digests, admin, account, rate limit, email
  lib/            pure domain logic: url safety, extraction, summariser, topics, digest builder, Gemini client
  db/             Drizzle schema + connection (Neon / PGlite)
drizzle/          SQL migrations
tests/            Vitest unit + integration tests
docs/             weekly FYP deliverables (personas, SRS, architecture, ERD/API/wireframes, testing & security)
```

## Documentation
1. [Problem discovery & personas](docs/01-problem-discovery-and-personas.md)
2. [Software Requirements Specification (IEEE 830)](docs/02-srs.md)
3. [Architecture, DFDs & cloud topology](docs/03-architecture.md)
4. [ERD, API contracts & wireframes](docs/04-database-api-wireframes.md)
5. [Testing & security audit](docs/05-testing-and-security-audit.md)
6. [Midterm progress report & demo checklist](docs/06-midterm-progress-report.md)
