# Together UAT Guide

Practical guide for testing every feature from the UI locally. Written for non-technical testers.

---

## Prerequisites

Install these before starting:

- **Bun** — `curl -fsSL https://bun.sh/install | bash`
- **Docker** — [docker.com/get-started](https://docs.docker.com/get-started/install/)
- A modern web browser (Chrome, Firefox, or Safari)

---

## Starting the Stack

Run these commands from the project root (`together-ng/`):

### 1. Start Postgres and Redis

```bash
docker compose up -d
```

Wait until both containers are healthy (~10 seconds). Verify with:

```bash
docker compose ps
```

Both should show "healthy" status.

### 2. Install dependencies

```bash
bun install
```

### 3. Set up the database

```bash
bun run --filter @together/api db:migrate
bun run --filter @together/api db:seed
```

Migrations create all tables. Seed populates 17 categories (Education, Technology, Science, etc.) that you'll select when creating requests and profiles.

### 4. Start the API and Web servers

```bash
bun run dev
```

This starts both servers. Wait for the output:

```
@together/api listening on http://localhost:4000
```

The web app runs at **http://localhost:5000**.

### 5. Verify the stack is running

Open **http://localhost:5000** in your browser. You should see the Together homepage with "No published requests yet." if the database is empty.

You can also check the API health endpoint: open **http://localhost:4000/health** — you should see `{"status":"ok"}`.

---

## Test Accounts

There are no pre-seeded user accounts. You'll create accounts during testing. Use the **email registration** path for the simplest flow.

> **Tip:** If you need two separate users (e.g. a requester and a contributor), register two accounts with different email addresses in separate browser windows (one normal, one incognito/private).

---

## Feature Test Paths

### 1. Registration (Email)

1. Open **http://localhost:5000**
2. Click **"Sign in"** in the top navigation
3. Click **"Register"** link below the form
4. Ensure the **"Email"** tab is selected
5. Fill in:
   - **Name:** `Alice Test`
   - **Email:** `alice@test.com`
   - **Password:** `password123`
6. Click **"Create account"**
7. **Expected:** You are redirected to the onboarding page (`/onboarding`)

### 2. Registration (Phone with OTP)

1. Open **http://localhost:5000/auth/register**
2. Click the **"Phone"** tab
3. Enter a phone number in E.164 format: `+2348012345678`
4. Click **"Send verification code"**
5. **Expected:** A code entry form appears. In local development with `OTP_PROVIDER=mock`, check the API server logs — the OTP code is printed there (typically `000000` for mock).
6. Enter the 6-digit code
7. Click **"Verify"**
8. **Expected:** You are redirected to onboarding

### 3. Profile Creation (3-Step Onboarding)

After registration you land on `/onboarding`. The flow has 3 steps:

**Step 1 — Profile Basics:**
1. **Name** is pre-filled from registration. Edit if desired.
2. **Photo URL** (optional): paste any image URL, e.g. `https://picsum.photos/200`
3. **Location** (optional): type `Lagos, Nigeria`
4. **About you** (optional): type a short bio
5. Under **"What can you help with?"**, check one or more categories (e.g. "Technology", "Education"). Skills load when you check a category — optionally check specific skills.
6. Click **"Next"**

**Step 2 — Refine Skills:**
1. Optionally check specific skills from the loaded list
2. Click **"Next"**, or click **"Skip — I just need help for now"** to skip skills

**Step 3 — Contribution Availability:**
1. Under "How can you contribute?", check **Online** and/or **In person**
2. Optionally fill in a preferred geographic area
3. Under "What are you willing to do?", check any that apply: **Lend resources**, **Mentor**, **Answer questions**, **Collaborate**
4. Click **"Complete setup"**
5. **Expected:** You are redirected to the home feed (`/`)

> **Alternative:** At any step you can click **"Skip — I just need help for now"** to skip the rest of onboarding and land on the feed with a basic profile.

### 4. Login

1. Open **http://localhost:5000/auth/login**
2. Enter the email and password you registered with
3. Click **"Sign in"**
4. **Expected:** You are redirected to the home feed, and your name appears in the top navigation

### 5. Creating a Request (6-Step Wizard)

1. Click **"Ask for help"** in the top navigation, or go to **http://localhost:5000/requests/new**
2. You must be logged in. If not, you'll be redirected to login first.

**Step 1 — Category:**
1. Select a category from the list (e.g. "Technology")
2. Click **"Continue"**

**Step 2 — Goal:**
1. Describe what you're trying to accomplish, e.g. "I need a laptop for a coding bootcamp"
2. Click **"Continue"**

**Step 3 — Barrier:**
1. Describe what's preventing progress, e.g. "I can't afford a laptop and my current computer is too old to run development tools"
2. Click **"Continue"**

**Step 4 — Requested Help:**
1. Describe what would help, e.g. "Someone who can lend me a laptop for 3 months, or point me to a lending program"
2. Click **"Continue"**

**Step 5 — Optional Details:**
1. Fill in any optional fields (modality, location, skill level, duration, deadline, etc.)
2. Click **"Continue"**

**Step 6 — Preview:**
1. Review your request. Quality hints may appear suggesting improvements.
2. Click **"Edit"** next to any field to go back and change it
3. Click **"Publish"** to make the request live
4. **Expected:** You see a "Request published!" toast, then you're redirected to the request detail page at `/requests/<id>`

### 6. Discovery Feeds, Search, and Filtering

The discovery experience enables browsing, category filtering, keyword search, and multi-facet filtering for community requests.

#### 6.1 Featured Feed (Homepage)
1. Open **http://localhost:5000/** (unauthenticated or signed in)
2. **Expected:** The homepage displays the Featured feed with community request cards in vote-weighted rank order (higher supported requests appear before newer zero-vote requests).
3. Each request card displays:
   - **Title** linking to `/requests/<id>`
   - **Goal snippet** (or help needed summary)
   - **Category badge** (e.g., Technology, Education)
   - **Location or modality badge** (e.g., "Online", "In person", or city name like "Lagos")
   - **Vote count** (e.g., "14 votes")
   - **State badge** ("Published" or "Receiving Responses" — draft/archived requests are hidden)
4. Click **"View request →"** or the request title to navigate to `/requests/<id>`.

#### 6.2 Category Feeds
1. Navigate to a category feed directly via URL (e.g. **http://localhost:5000/categories/technology**).
2. **Expected:** The page header shows category breadcrumbs, category title ("Technology"), and description.
3. Only requests published in that category are shown. No requests from other categories appear.
4. **Empty Category Test:** Navigate to an empty category (e.g. `/categories/gardening` if no requests exist).
   - **Expected:** An empty state appears with "No requests yet", a helpful prompt, an **"Ask for help"** button pointing to `/requests/new`, and a **"Browse all requests"** button pointing to `/`.

#### 6.3 Search with Stemming
1. In the search input on the homepage, type a keyword such as `laptop` and click **"Search"** (or press Enter).
2. **Expected:** The URL updates to `/?q=laptop`. The results include requests containing "laptop" and stemmed variations like "laptops".
3. Search uses English full-text search (`tsvector` + GIN) and trigram matching (`pg_trgm`).
4. **Empty Search Test:** Search for a non-existent phrase (e.g., `xyzunknown999`).
   - **Expected:** An explicit empty state displays "No results for 'xyzunknown999'", a **"Clear search"** button, and a **"Browse featured requests"** button.

#### 6.4 Combinable Filters
1. On the homepage or search results, locate the filter bar below the search form.
2. Select a **Category** (e.g., "Technology").
3. Select a **Modality** (e.g., "Online").
4. Select a **Type of help** (e.g., "Learn skill").
5. Enter a **Location** (e.g., "Lagos").
6. Change **Sort by** (e.g., "Most supported", "Newest", or "Still open").
7. **Expected:** URL search parameters update automatically (e.g., `?category=technology&modality=online&helpType=learn&sort=newest`) without a full page reload. The feed returns the **intersection** of all selected filters.
8. Click **"Reset filters"** (or **"Clear"** on search) to reset back to default parameters.

#### 6.5 Pagination
1. When more than 20 requests match the active feed or query, pagination controls appear at the bottom.
2. Click **"Load more"** (or navigate to `?page=2`).
3. **Expected:** Page 2 results are displayed without duplicate cards, and pagination status shows "Page 2 of N".

### 7. Voting on a Request

1. Log in as a **different user** (the one who didn't create the request — you cannot vote on your own request)
2. Navigate to a request detail page (click a request in the feed)
3. Click the **upvote button** (the triangle icon △ with the vote count)
4. **Expected:** The vote count increases by 1, the icon changes to filled (▲)
5. Click the button again to **remove your vote**
6. **Expected:** The vote count decreases by 1, the icon reverts to outline (△)

> **Note:** Vote updates are broadcast in real-time via WebSocket. If you have two browser tabs open on the same request, both should update instantly.

### 8. Offering Help ("I can help")

1. Log in as the **contributor** (the different user)
2. Navigate to a published request's detail page
3. Click the **"I can help"** or offer button (if available in the UI)
4. If no dedicated offer button exists in the UI yet, you can test via the API:
   - The offer endpoint is `POST /requests/:id/offers`
   - Body: `{ "message": "I have a laptop you can borrow for 3 months", "modality": "in_person" }`
5. **Expected:** The offer is created with status `pending`

### 9. Accepting/Declining Offers

1. Log in as the **request author** (Alice)
2. View the request detail page — offers from contributors should be listed
3. Click **"Accept"** on an offer
4. **Expected:**
   - The offer status changes to `accepted`
   - The request state transitions to `help_arranged`
   - The contributor receives a notification: "Your offer was accepted"
5. Alternatively, click **"Decline"** on an offer
6. **Expected:**
   - The offer status changes to `declined`
   - The contributor receives a notification: "Your offer was declined"

### 10. Contributing and Marking Complete

1. Log in as the **contributor** whose offer was accepted
2. The contribution starts in `accepted` (or `in_progress`) status
3. Mark the contribution as **completed**:
   - The contributor endpoint is `POST /contributions/:id/complete`
   - Body: `{ "notes": "Delivered the laptop on Monday" }`
4. **Expected:**
   - The contribution status changes to `completed`
   - The request author receives a notification: "A contribution has been marked as completed. Please confirm."

### 11. Two-Sided Confirmation

After the contributor marks completion, the **request author** must confirm:

1. Log in as the **request author**
2. Confirm the contribution:
   - The endpoint is `POST /contributions/:id/confirm`
   - Body: `{ "completedAsAgreed": true }`
3. **Expected:**
   - A `contributor_confirmations` record is created
   - The contributor receives a notification: "Your completion has been confirmed"
   - The contribution is fully completed

> **Important:** The contributor **cannot** confirm their own completion — only the request author can. If the contributor tries, they get a `CANNOT_CONFIRM_OWN_COMPLETION` error.

### 12. Outcome Submission

After confirmation, the **request author** submits an outcome:

1. Log in as the **request author**
2. Submit the outcome:
   - The endpoint is `POST /contributions/:id/outcome`
   - Body: `{ "response": "yes_significantly", "explanation": "The laptop was exactly what I needed for the bootcamp" }`
3. **Expected:**
   - An `outcome_confirmations` record is created
   - The contributor receives a notification: "The recipient has recorded the outcome of your contribution"
   - The response field accepts: `yes_significantly`, `yes_somewhat`, `not_yet`, `no`

> **Important:** Only the request author (recipient) can submit an outcome — not the contributor.

### 13. Viewing Profile

1. Click your name in the top navigation
2. Go to **http://localhost:5000/profile/<your-user-id>**
3. **Expected:** The profile page displays with:
   - "Contributor since" date
   - "People helped" count (distinct recipients who received helpful contributions)
   - "Successful contributions" count
   - Empty state shows 0/0 if no contributions yet

### 14. Notifications

1. Log in as either user (contributor or request author)
2. The notifications API endpoint is `GET /notifications`
3. **Expected:** You see notifications for actions that happened:
   - "Your offer was accepted" (contributor)
   - "A contribution has been marked as completed. Please confirm." (request author)
   - "Your completion has been confirmed" (contributor)
   - "The recipient has recorded the outcome of your contribution" (contributor)
4. Mark a notification as read: `PATCH /notifications/:id` with body `{ "read": true }`
5. Mark all as read: `POST /notifications/read-all`

### 15. Category Browsing

1. Go to **http://localhost:5000/categories/technology** (or any slug)
2. **Expected:** The page shows "Category: technology" with a "No requests in this category yet" message (or lists requests if some exist in that category)

### 16. Discovery / Search

1. Go to the home feed at **http://localhost:5000/**
2. The feed shows published requests ordered by most recent
3. Click any request title to view its details
4. The feed endpoint is `GET /requests/featured` — it returns the 20 most recent published requests with vote counts

### 17. Admin Category Management (`/admin/categories`)

For a tester with an admin account, to manage the request taxonomy:

1. Open `/admin/categories` in the admin app and sign in as an admin. **Expected:** a list of top-level categories, each showing name, slug, status (Active/Retired), subcategory count and skill count; subcategories appear nested/indented under their parent.
2. Add a category: type a name (e.g. `Gardening`) in "New category name" and submit. **Expected:** the category appears in the list and immediately in the public category picker backed by `GET /categories`.
3. Manage a category: click "Manage" on a row. **Expected:** a detail panel with rename, retire/restore, subcategory creation, skill creation, merge, and related-link forms, plus a "Related: ..." line.
4. Rename: change the name and save. **Expected:** the new name shows in the list and in `GET /categories`; the category id never changes.
5. Retire: click "Retire category". **Expected:** status flips to Retired and it disappears from the new-request picker, but existing requests in that category still open; "Restore category" brings it back.
6. Merge: pick another active category under "Merge into" and submit. **Expected:** the source retires with a "merged into" marker and its requests move to the target (none left behind).
7. Related: pick a category under "Link related" and submit. **Expected:** both categories' detail panels list each other under "Related: ...".
8. Validation to try: duplicate active names are rejected with a conflict error; merging a category into itself and retiring an already-retired category are rejected with a clear `400` error.

### 18. Sharing a Request (Shareable URL + Social Preview)

1. Publish a request (follow section 5 until the request state is "Receiving responses"), then open its detail page at `http://localhost:5000/requests/<id>` (copy the URL from the address bar).
2. **Expected:** The page shows the request title, goal summary, category badge, a **Share** button, and (when logged out) a **"Join Together to help"** link — no login required to view.
3. Click **Share** on a phone/with Web Share support → **Expected:** the native share sheet opens with the title, summary, and link. On desktop → **Expected:** the button changes to **"Link copied"** and a "Link copied" toast appears.
4. Paste the copied link into a new incognito window → **Expected:** the same title, goal, category, and Join CTA render with no login.
5. View Source on the detail page → **Expected:** `<meta property="og:title">`, `og:description`, `og:url` (equals the page URL), `og:image` (fallback card), `1200`/`630` dimensions, and `twitter:card = summary_large_image` are all present and non-empty in the initial HTML.
6. Open one of your own **draft** request URLs in incognito → **Expected:** "Request not found" with generic metadata (no draft title/description leaks); open it while logged in as the author → **Expected:** the draft renders with a state badge ("only you can see this request in its current state").
7. Edit the request title, reload, View Source → **Expected:** both the page heading and `og:title` show the new title.

### 19. Admin Report Review and Moderation

Requires an admin account (a user row with `is_admin = true`; sign in via the admin app).

1. Open the admin app and sign in as admin, then go to **Reports** (`/admin/reports`).
2. **Expected:** The queue lists reported content with Reason, Category, Status, Created date, and a "View report" link per row. As a non-admin you get an access error instead.
3. Use the **Category** dropdown and select **Requests**.
4. **Expected:** Only request reports remain listed.
5. With an empty queue, **Expected:** "No reports pending" (not a blank page). While loading you see a skeleton; on API error a **Retry** button appears.
6. Click **"View report"** on a row.
7. **Expected:** Detail shows reason, description, category, status, and the reported content snapshot (request title/body, profile, contribution, etc.) with no reporter name/avatar.
8. Click **Suspend**, then as the reported user open `GET /auth/me` or try creating a request.
9. **Expected:** The user gets `403 ACCOUNT_SUSPENDED`. Back as admin, act **Restore** on a new report for the same user — the user can act again.
10. Open **Audit Log** (`/admin/audit-log`).
11. **Expected:** Every moderation action appears newest-first with actor, action, target, and timestamp; filter by action (e.g. `suspend`) and page through results. API: `GET /admin/audit-log?page&limit&action=suspend`.

Quick API reference: `GET /admin/reports`, `GET /admin/reports/:id`, `POST /admin/reports/:id/action` with `{ "action": "warn" | "restrict" | "suspend" | "restore" | "dismiss", "reason": "..." }`, `GET /admin/audit-log`.

---

## Request State Machine

Requests transition through these states during the happy path:

```
draft → published → receiving_responses → help_arranged → in_progress → completed → closed
```

At each state, different actions are available:
- **draft**: Edit, publish
- **published**: Vote, offer help
- **receiving_responses**: Vote, offer help, accept/decline offers
- **help_arranged**: Start contribution
- **in_progress**: Mark contribution complete
- **completed**: Confirm completion, submit outcome, close

---

## Quick Reference: API Endpoints

| Action | Method | Endpoint |
|---|---|---|
| Register | POST | `/auth/register` |
| Login | POST | `/auth/login` |
| Get current user | GET | `/auth/me` |
| Create profile | POST | `/profiles` |
| Get my profile | GET | `/profiles/me` |
| List categories | GET | `/categories` |
| Get skills for category | GET | `/categories/:id/skills` |
| Create request | POST | `/requests` |
| Get request | GET | `/requests/:id` |
| Edit request (draft) | PATCH | `/requests/:id` |
| Preview request | GET | `/requests/:id/preview` |
| Publish request | POST | `/requests/:id/publish` |
| Vote on request | POST | `/requests/:id/vote` |
| Remove vote | DELETE | `/requests/:id/vote` |
| Submit offer | POST | `/requests/:id/offers` |
| List offers | GET | `/requests/:id/offers` |
| Accept offer | POST | `/requests/:id/offers/:offerId/accept` |
| Decline offer | POST | `/requests/:id/offers/:offerId/decline` |
| Get contribution | GET | `/contributions/:id` |
| Mark complete | POST | `/contributions/:id/complete` |
| Confirm completion | POST | `/contributions/:id/confirm` |
| Submit outcome | POST | `/contributions/:id/outcome` |
| List notifications | GET | `/notifications` |
| Mark notification read | PATCH | `/notifications/:id` |
| Mark all read | POST | `/notifications/read-all` |
| Featured feed | GET | `/requests/featured` |
| Category feed | GET | `/categories/:id/requests` |
| Search requests | GET | `/requests/search` |
| Health check | GET | `/health` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Feed unavailable" on homepage | Ensure the API is running on port 4000. Check `docker compose ps` for Postgres/Redis. |
| Categories don't load in onboarding | Run `bun run --filter @together/api db:seed` to populate categories. |
| Registration fails silently | Check API server logs for error messages. |
| Cannot vote on own request | This is expected — use a second account. |
| OTP code not working | In development, check API terminal output for the mock OTP code. It's typically `000000`. |
| Port conflict on 5433 or 6380 | Another service may be using those ports. Stop it, or change `POSTGRES_PORT`/`REDIS_PORT` in `.env` and update `DATABASE_URL`/`REDIS_URL` to match. |

---

## Happy Path Summary (End-to-End)

This is the complete flow from zero to a fully completed request:

1. **Alice** registers with email → lands on onboarding
2. **Alice** completes profile (name, location, categories, skills)
3. **Alice** creates a request via the wizard (category → goal → barrier → help → optional → publish)
4. **Bob** registers with a different email → completes profile
5. **Bob** sees Alice's request in the feed → clicks into it → clicks the vote button
6. **Bob** submits an offer: "I can lend you my laptop for 3 months"
7. **Alice** views the request → sees Bob's offer → clicks **Accept**
8. **Bob** sees notification: "Your offer was accepted"
9. **Bob** marks the contribution as complete: "Delivered the laptop"
10. **Alice** sees notification: "A contribution has been marked as completed. Please confirm."
11. **Alice** confirms the contribution: "Completed as agreed"
12. **Bob** sees notification: "Your completion has been confirmed"
13. **Alice** submits outcome: "yes_significantly — the laptop was exactly what I needed"
14. **Bob** sees notification: "The recipient has recorded the outcome of your contribution"
15. Both users check their profiles to see reputation data updated
