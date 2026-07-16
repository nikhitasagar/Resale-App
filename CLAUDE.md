# Resale App — Project Brief

A small web app where people list clothing items for resale. Product info (name, image, type)
is pulled live from a real Shopify storefront via search; the lister only adds a size. Listings
are only visible to logged-in users.

Read this whole file before writing any code. `supabase/schema.sql` and
`supabase/functions/search-products/index.ts` in this repo are the canonical versions of the SQL
and edge function below — keep them in sync if you change one.

## Tech stack (do not deviate without asking)

- **Frontend:** plain HTML/CSS/vanilla JS, no build step, no framework. Load the Supabase JS
  client via ESM CDN import (`https://esm.sh/@supabase/supabase-js@2`). This keeps the site a
  pure static bundle that deploys to GitHub Pages with zero tooling.
- **Backend:** Supabase (Postgres + Auth + Edge Functions), free tier.
- **No file uploads, no image storage.** Images are the storefront's own CDN URLs, stored as
  plain text in the database.

## Functional requirements

1. Users create resale listings.
2. A listing has: item name, image, size, item type, style number, material.
3. Item name, image, item type, style number, and material are **pulled from a live Shopify
   storefront** via search (see "Product search" below) — never typed in or uploaded by the
   lister.
4. The lister manually enters the size (this is the one field the storefront's API can't give us).
5. Every user has an account. Logged-in users can browse listings and post their own.
6. An account stores: display name, Instagram handle (their contact method).
7. Every listing shows the lister's name and @handle so viewers know how to contact them.
8. Lister actions on their own listings: add, mark sold, mark archived, mark deleted (soft
   delete only — never a hard DB delete).
9. Logged-in users can view all active/sold listings, and can search by item name, style
   number, or material, plus filter by item type and size.
10. Logged-out users cannot view any listing data — enforced at the database level (Row Level
    Security), not just hidden in the UI. This is a hard requirement, not a nice-to-have.
11. Users can view and edit their own account details (display name, Instagram handle) from a
    profile page.
12. Users can save/unsave any listing; saved listings show up on their profile page.
13. Users can update their own login email and/or password from the profile page.
14. Users can permanently delete their own account (profile, all listings, all saved listings)
    from the profile page. This is a real hard delete — distinct from the listing-level soft
    delete in requirement #8, which still applies to listings and never changes.

## Non-goals (v1 — do not build these unless asked)

- Payments or checkout of any kind
- In-app messaging (contact happens on Instagram, outside the app)
- Admin/moderation dashboard
- Multi-brand support (a single brand's catalog only, for now)
- Any image upload/storage pipeline

## Data model

Canonical file: `supabase/schema.sql`. Three tables:

- `profiles` — one row per user, extends `auth.users`. Fields: `name`, `instagram_handle`.
- `listings` — one row per resale item. Fields: `seller_id` (→ profiles, `on delete cascade`),
  `shopify_product_id`, `item_name`, `image_url`, `item_type`, `style_number`, `material`, `size`,
  `status` (enum: `active`, `sold`, `archived`, `deleted`), timestamps.
- `saved_listings` — join table for bookmarking. Fields: `user_id` (→ profiles, `on delete
  cascade`), `listing_id` (→ listings, `on delete cascade`), unique on `(user_id, listing_id)`.
  Private to the user who saved it.

`status = 'deleted'` **is** the soft delete for listings — a lister marking their own item
deleted is always an UPDATE, never a real DELETE. This is unrelated to account deletion: the
foreign keys above cascade specifically so that a user closing their *own account* (see "Account
deletion" below) results in a genuine hard delete of everything tied to them. Don't read the two
as contradictory — one is "how a listing's lifecycle works," the other is "what happens when a
person leaves the platform entirely."

## Row Level Security (the actual security boundary)

Canonical file: `supabase/schema.sql`. Key point for requirement #10: the frontend is a public
static site, so hiding pages/buttons in JS is UX only, not security. The real gate is Postgres
RLS:

- `listings` select policy: `auth.role() = 'authenticated'` only — anonymous requests get zero
  rows back, full stop.
- `listings` insert policy: `auth.uid() = seller_id` — you can only create listings as yourself.
- `listings` update policy: `auth.uid() = seller_id` — you can only change status on your own
  listings (this is how "mark sold/archived/deleted" works — it's just an UPDATE on `status`).
- No delete policy exists at all — reinforces that hard deletes shouldn't happen.
- `profiles` select policy: `auth.role() = 'authenticated'` — logged-in users can see each
  other's name/handle (needed to display contact info on listings), but logged-out users can't.
  Note this also means any authenticated user can query the whole `profiles` table directly,
  not just profiles tied to a listing they're viewing — acceptable since Instagram handles are
  already meant to be a public contact method.
- `profiles` insert/update policy: `auth.uid() = id` only.
- `saved_listings` policy (all operations): `auth.uid() = user_id` — a user can only
  see/create/delete their own saved-listing rows; nobody can see what anyone else has saved.

Do not weaken these policies for convenience during development — build the login flow first so
you're always testing against a real authenticated session.

## Product search

The catalog comes from a single brand's Shopify storefront, via its public, no-auth-required
`/search/suggest.json` endpoint — see `supabase/functions/search-products/index.ts` for the
exact URL. No API key or secret is needed; the endpoint is public.

This can't be called directly from the frontend — Shopify doesn't send permissive CORS headers
on this endpoint, so browser `fetch()` calls from a github.io origin will be blocked. That's
why there's a Supabase Edge Function (`supabase/functions/search-products/index.ts`) acting as
a thin proxy: it calls the storefront's endpoint server-side (no CORS issue server-to-server)
and returns normalized JSON to the frontend.

`style_number` and `material` aren't dedicated fields in the search response — both are
embedded as `<li>` bullets inside the HTML `body` description, e.g. `<li>53% Polyester, 43%
Wool, 4% Elastane</li><li>Style Number: T000TW8013</li>`. The edge function strips tags off each
`<li>`, then: the style number is whichever item matches `Style Number:\s*(\S+)`; the material
is the first item (excluding that one) containing a `\d{1,3}%` pattern, which also correctly
picks up variants like `Upper: 100% Cotton Fabric, 100% Suede Leather`. Either can come back
`null` if a product's description doesn't follow this structure — both are nullable columns.

Be a reasonable citizen of the storefront's server: debounce the search-as-you-type input
(~300ms) so you aren't firing a request per keystroke.

## Account deletion

A user closing their own account needs a real hard delete of `auth.users`, which only the
Supabase Admin API can do (`auth.admin.deleteUser`) — that requires the service role key, which
must never reach the frontend. So this is a Supabase Edge Function
(`supabase/functions/delete-account/index.ts`), deployed **with** JWT verification (the default —
no `--no-verify-jwt`, unlike `search-products`):

1. The function reads the caller's own JWT from the `Authorization` header and resolves it to a
   user via an anon-scoped client — it never trusts a user id passed in the request body.
2. It then uses a service-role client to call `auth.admin.deleteUser(user.id)`. The service role
   key doesn't need to be configured — Supabase auto-injects `SUPABASE_SERVICE_ROLE_KEY` into
   every Edge Function's environment.
3. Deleting the `auth.users` row cascades through `profiles` → `listings` → `saved_listings` via
   the `on delete cascade` foreign keys above — one call removes everything.

Frontend calls it with `supabase.functions.invoke('delete-account')`; the user's session token is
attached automatically. `profile.html` requires typing "DELETE" into a confirmation field before
this fires, since it's irreversible.

## Pages / routes

Plain multi-page static site (no client-side router needed):

- `login.html` — email/password, magic link, or "Continue with Google" sign-in, plus "Forgot
  password?" (calls `supabase.auth.resetPasswordForEmail`). A password-recovery link also
  establishes a session, so this page listens for the `PASSWORD_RECOVERY` auth event (and checks
  the URL hash for `type=recovery` before the initial session check) to show a "set new
  password" form instead of silently redirecting into the app.
- `signup.html` — create account (email/password or "Continue with Google"), then immediately
  prompt for name + Instagram handle (writes to `profiles`). A Google name, if available, is
  pre-filled.
- `index.html` — the feed, and the app's homepage once logged in. Protected. Query `listings`
  where `status in ('active','sold')`, joined with `profiles` for name + @handle. Client-side
  search across item name, style number, and material, plus filters (by item type, by size)
  over the fetched set. Each card shows style number/material and has a Save/Unsave toggle.
  Redirect to `login.html` if there's no session.
- `new-listing.html` — protected. Search box wired to the `search-products` edge function → pick
  a result → enter size → insert into `listings`.
- `my-listings.html` — protected. Shows the current user's own listings (all statuses except
  `deleted`) with buttons to flip status to sold/archived/deleted.
- `profile.html` — protected. View/edit the current user's `profiles` row (name, Instagram
  handle); update login email/password via `supabase.auth.updateUser`; a "Saved listings"
  section listing everything in `saved_listings` for this user; a "Danger zone" that calls the
  `delete-account` edge function after a typed "DELETE" confirmation.

Every protected page should check for a Supabase session on load and redirect to `login.html`
if there isn't one. Remember: this check is a UX courtesy, not the security — RLS is.

## Config

`config.js` at the repo root holds the Supabase project URL and **publishable key**:

```js
export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "YOUR-PUBLISHABLE-KEY";
```

This file is safe to commit. The publishable key (Supabase's newer name for the anon key) is
meant to be public in every Supabase client app — RLS is what enforces access, not secrecy of
this key. Do not try to hide it in an env var that a static site can't read at runtime anyway.
Never commit a Supabase *service role* key anywhere in the frontend — the `delete-account`
function is the one place that needs it, and it gets it from the auto-injected
`SUPABASE_SERVICE_ROLE_KEY` env var, not from this file.

### Auth email redirect URLs

Magic-link and signup-confirmation emails redirect wherever `emailRedirectTo` says
(`js/auth.js` sets it to the calling page's own URL, so it adapts to local dev vs. the deployed
origin automatically). But Supabase Auth only honors an `emailRedirectTo` that matches an entry
in the project's **Authentication → URL Configuration → Redirect URLs** allow-list — anything
else silently falls back to the dashboard's default **Site URL** (which is `http://localhost:3000`
on a fresh project). If magic-link/confirmation emails land on a dead `localhost` URL, this
allow-list is almost certainly the reason — add the deployed site (e.g.
`https://YOUR-USERNAME.github.io/YOUR-REPO/**`) there, and set Site URL to match.

### Google OAuth sign-in

`signInWithGoogle()` in `js/auth.js` wraps `supabase.auth.signInWithOAuth({ provider: 'google' })`
with `redirectTo` set to the calling page's own URL (same pattern as the email redirects above —
still needs to be in the Redirect URLs allow-list). It's wired into both `login.html` and
`signup.html`; either works for both new and returning users because the existing
session-then-profile-check logic on both pages already handles it — a Google sign-in just
means the "no profile yet" branch fires for first-timers, sending them to fill in name +
Instagram handle (with name pre-filled from their Google account if available), same as any
other new signup.

Setup lives entirely outside this repo (a Google Cloud OAuth client + a toggle in Supabase's
dashboard) — nothing to keep in sync here beyond this button. One thing worth knowing if this
app has enough users: while the Google OAuth consent screen is in "Testing" status, Google caps
it at 100 allow-listed test users; past that, it needs to be published to "Production," which
may show a "Google hasn't verified this app" warning until Google reviews it. Neither is a
security concern — both are Google's own gating, unrelated to anything in this codebase.

### Cache-busting

Every `<script src="js/...">`/`<link href="css/style.css">` and every inter-module `import
... from "./file.js"` carries a shared `?v=N` query suffix. There's no build step to hash
filenames, so without this, GitHub Pages' `cache-control: max-age=600` plus normal browser
caching means users can silently keep running old JS/CSS after a deploy. **Bump `v` on every
file that changes** (a simple project-wide find/replace) whenever you edit anything under `js/`
or `css/`.

## Repo layout to produce

```
/
├── index.html
├── login.html
├── signup.html
├── new-listing.html
├── my-listings.html
├── profile.html
├── config.js
├── css/style.css
├── js/
│   ├── supabase-client.js
│   ├── auth.js
│   ├── feed.js
│   ├── new-listing.js
│   ├── my-listings.js
│   └── profile.js
├── supabase/
│   ├── schema.sql
│   └── functions/
│       ├── search-products/index.ts
│       └── delete-account/index.ts
├── CLAUDE.md
├── SETUP.md
└── README.md
```

## Definition of done

- [ ] Logged-out visitor hitting `index.html` (or the API directly) gets no listing data
- [ ] Signup collects name + Instagram handle before letting someone post
- [ ] New-listing search hits the real catalog through the edge function, no manual entry of
      name/image/type
- [ ] Every listing card shows the lister's name + @handle
- [ ] Sold/Archived/Deleted are all just status updates — no hard deletes anywhere
- [ ] Site works as static files with no build step, ready for GitHub Pages
- [ ] Users can view/edit their name + Instagram handle from `profile.html`
- [ ] Feed supports search-by-name and filter-by-type/size
- [ ] Saved listings persist per-user and are private to that user (RLS-enforced)
- [ ] Users can update their login email/password from `profile.html`
- [ ] Deleting an account removes the auth user, profile, listings, and saved listings — a real
      hard delete, confirmed via cascading foreign keys, distinct from listing soft-delete
- [ ] Style number and material are pulled from the storefront and searchable in the feed
