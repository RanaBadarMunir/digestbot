# Week 1 — Problem Discovery & User Personas

**Project:** DigestBot – Smart Bookmark-to-Weekly Newsletter Summarizer
**Project ID:** PTUT-PRJ-096 · **Track:** 10. Productivity, Remote Work & Asynchronous Collaboration

---

## 1. Discovery method

| Step | What was done | Output |
|---|---|---|
| 1 | Semi-structured interviews with knowledge workers who save links "for later" (developers, product people, researchers, students) | Interview notes (template in §6) |
| 2 | Review of how people currently save links: browser bookmarks, Pocket-style read-later apps, "Saved messages" in Telegram/WhatsApp, starred Slack messages, Notion pages, open browser tabs | Current-workflow map (§2) |
| 3 | Affinity mapping of pain points into themes | Friction themes (§3) |
| 4 | Persona synthesis and MVP feature prioritisation (MoSCoW) | Personas (§4), MVP features (§5) |

> **Note for the submission:** the interview template in §6 must be filled in with the real interviews you
> conduct (minimum 5 people). Replace the illustrative quotes in §3 with quotes from your own interviewees
> before submitting; the themes below are what we expect to hear and are what the product was designed against.

## 2. Current workflow ("as-is")

1. A professional sees an interesting article, tweet/X thread, or technical blog during the day.
2. They have no time right now, so they bookmark it (browser star, read-later app, "send to self" chat).
3. Links pile up across 3–5 different places. Nothing reminds them, nothing ranks them.
4. Weeks later the list holds 50+ links. Opening it feels like homework, so it is ignored.
5. Value is lost: the knowledge they meant to absorb never arrives, and they feel guilty about the backlog.

## 3. Friction themes found

| # | Theme | Evidence (illustrative quote — replace with yours) | Impact |
|---|---|---|---|
| F1 | **Backlog overwhelm** — the list grows faster than it is read | "I have 300 bookmarks. I'll never read them, I just keep adding." | High |
| F2 | **No triage** — every link looks equally important; titles say nothing | "I can't tell which of these 50 links is actually worth 15 minutes." | High |
| F3 | **Scattered sources** — links live in the browser, chats, Slack, notes | "Half my links are in Telegram 'Saved Messages'." | Medium |
| F4 | **No rhythm** — no moment in the week is reserved for catching up | "If something doesn't land in my inbox, it doesn't exist." | High |
| F5 | **Lost context** — by the time they open a link, they forgot why they saved it | "Why did I save this? No idea." | Medium |
| F6 | **Team knowledge stays private** — useful finds aren't shared with the team | "I find great posts but never get round to sharing them." | Low (post-MVP) |

## 4. User personas

### Persona 1 — "Ayesha, the Busy Software Engineer"

| | |
|---|---|
| **Role** | Senior backend engineer at a remote-first SaaS company |
| **Age / location** | 29, Lahore (works with a team in Europe — async, timezone-shifted) |
| **Tech comfort** | Very high; lives in the browser, Slack, GitHub |
| **Saves per week** | 20–30 links: engineering blogs, release notes, X/Twitter threads, conference talks |
| **Goal** | Stay current with her stack (Postgres, Kubernetes, AI tooling) without losing evenings |
| **Pain points** | F1 backlog overwhelm (400+ bookmarks), F2 can't tell what's worth reading, F5 forgets why she saved something |
| **Current tools** | Chrome bookmarks folder "READ LATER", Pocket (abandoned), open tabs (60+) |
| **Quote** | "I don't need more content. I need someone to tell me what my own bookmarks say." |
| **What success looks like** | One email on Sunday morning: a 5-minute read covering everything she saved, grouped by topic, with the 3 links that truly deserve a full read flagged |
| **Key scenarios** | Saves a link in one click (bookmarklet) → never thinks about it again → reads the digest over Sunday tea → opens 2 full articles |

### Persona 2 — "Bilal, the Product Manager / Team Lead"

| | |
|---|---|
| **Role** | Product manager leading a 7-person distributed team |
| **Age / location** | 36, Karachi; travels and works across time zones |
| **Tech comfort** | Medium-high; heavy mobile user |
| **Saves per week** | 10–15 links: industry news, competitor launches, UX research, LinkedIn posts |
| **Goal** | Turn what he reads into decisions and share the best finds with his team every week |
| **Pain points** | F3 links scattered across WhatsApp, Slack and browser; F4 no weekly moment to review; F6 no easy way to share curated reading |
| **Current tools** | WhatsApp "message to self", Slack saved items, Notion page he rarely updates |
| **Quote** | "Every Friday I promise myself I'll send the team a reading list. I never do." |
| **What success looks like** | A weekly newsletter generated automatically that he can skim, and share with the team via one public link |
| **Key scenarios** | Imports his old browser bookmarks once → saves new links from his phone (share page) → on Friday opens the digest, toggles "share", posts the link in the team Slack channel |

## 5. Problem statement (final, one paragraph)

Knowledge workers in remote and asynchronous teams save dozens of articles, tweets and technical blogs every
week "to read later", but the saved links pile up across browsers, chat apps and read-later tools with no
triage, no reminder and no rhythm, so the backlog grows to 50+ unread links and the knowledge they meant to
absorb is lost. Existing bookmark tools store links but do not read, rank or summarise them, which turns the
backlog into guilt rather than value. **DigestBot** solves this by capturing links in one click, automatically
extracting and summarising each one with AI, classifying it by topic and priority, and delivering a single
weekly newsletter-style digest that a busy professional can read in about five minutes — and share with their
team — so that every saved link produces value without hours of reading.

## 6. MVP — 5 core features

| # | Feature | Persona / friction it addresses | Priority (MoSCoW) |
|---|---|---|---|
| 1 | **One-click capture** — paste a URL, a bookmarklet, a mobile share page, and bulk import of browser bookmarks (HTML export) | Ayesha F1, Bilal F3 | Must |
| 2 | **Automatic content extraction & AI summary** — fetch the page safely, extract the readable text, produce a 2–3 sentence TL;DR, 3 key points, reading time; Gemini AI with an offline extractive fallback | Ayesha F2, F5 | Must |
| 3 | **Smart triage** — automatic topic classification, tags and priority, plus search, filters and batch actions (mark read, archive, delete) | Ayesha F2, Bilal F3 | Must |
| 4 | **Weekly digest newsletter** — on the user's chosen day, all of the week's links are compiled into one digest grouped by topic, with an editor's intro and "worth a full read" picks; viewable in-app and optionally emailed | Ayesha F1, F4; Bilal F4 | Must |
| 5 | **Shareable digest link** — one toggle publishes a read-only public link to a digest for a team | Bilal F6 | Should |

Supporting (non-feature) requirements: secure multi-tenant accounts, admin portal with usage analytics,
responsive mobile layout.

**Out of MVP scope (Could / Won't for now):** browser extension, Slack/Telegram bot ingestion, team workspaces
with shared bookmark pools, native mobile apps, full-text archive of paywalled content.

## 7. Interview template (fill in per interviewee)

| Field | Answer |
|---|---|
| Interviewee (initials), role, date | |
| How do you currently save things to read later? Where? | |
| Roughly how many links do you save per week? How many do you actually read? | |
| Describe the last time you went back to your saved links. What happened? | |
| What makes a saved link worth reading vs. not? | |
| Would a weekly summary email help? What day/time? | |
| Would you share it with your team? | |
| Biggest frustration (their words) | |
| Persona fit (Ayesha / Bilal / neither) | |
