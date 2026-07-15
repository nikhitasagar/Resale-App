# Tibi Resale Marketplace — Project Brief

A small web app where people list Tibi clothing items for resale. Product info (name, image,
type) is pulled live from Tibi's real Shopify storefront; the lister only adds a size. Listings
are only visible to logged-in users.

Read this whole file before writing any code. `supabase/schema.sql` and
`supabase/functions/search-tibi/index.ts` in this repo are the canonical versions of the SQL
and edge function below — keep them in sync if you change one.

## Tech stack (do not deviate without asking)

- **Frontend:** plain HTML/CSS/vanilla JS, no build step, no framework. Load the Supabase JS
  client via ESM CDN import (`https://esm.sh/@supabase/supabase-js@2`). This keeps the site a
  pure static bundle that deploys to GitHub Pages with zero tooling.
- **Backend:** Supabase (Postgres + Auth + Edge Functions), free tier.
- **No file uploads, no image storage.** Images are Tibi's own CDN URLs, stored as plain text
  in the database.

## Functional requirements

1. Users create Tibi resale listings.
2. A listing has: item name, image, size, item type.
3. Item name, image, and item type are **pulled from Tibi's live Shopify storefront** via search
   (see "Tibi product search" below) — never typed in or uploaded by the lister.
4. The lister manually enters the size (this is the one field Tibi's API can't give us).
5. Every user has an account. Logged-in users can browse listings and post their own.
6. An account stores: display name, Instagram handle (their contact method).
7. Every listing shows the lister's name and @handle so viewers know how to contact them.
8. Lister actions on their own listings: add, mark sold, mark archived, mark deleted (soft
   delete only — never a hard DB delete).
9. Logged-in users can view all active/sold listings.
10. Logged-out users cannot view any listing data — enforced at the database level (Row Level
    Security), not just hidden in the UI. This is a hard requirement, not a nice-to-have.

## Non-goals (v1 — do not build these unless asked)

- Payments or checkout of any kind
- In-app messaging (contact happens on Instagram, outside the app)
- Admin/moderation dashboard
- Multi-brand support (Tibi only, for now)
- Any image upload/storage pipeline

## Data model

Canonical file: `supabase/schema.sql`. Two tables:

- `profiles` — one row per user, extends `auth.users`. Fields: `name`, `instagram_handle`.
- `listings` — one row per resale item. Fields: `seller_id` (→ profiles), `shopify_product_id`,
  `item_name`, `image_url`, `item_type`, `size`, `status` (enum: `active`, `sold`, `archived`,
  `deleted`), timestamps.

`status = 'deleted'` **is** the soft delete. There is no hard-delete path anywhere in the app.

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
- `profiles` insert/update policy: `auth.uid() = id` only.

Do not weaken these policies for convenience during development — build the login flow first so
you're always testing against a real authenticated session.

## Tibi product search

Tibi runs on Shopify. Its public, no-auth-required search endpoint:

```
https://www.tibi.com/search/suggest.json?q={query}&resources[type]=product&resources[limit]=10
```

This can't be called directly from the frontend — Shopify doesn't send permissive CORS headers
on this endpoint, so browser `fetch()` calls from a github.io origin will be blocked. That's
why there's a Supabase Edge Function (`supabase/functions/search-tibi/index.ts`) acting as a
thin proxy: it calls Tibi's endpoint server-side (no CORS issue server-to-server) and returns
normalized JSON to the frontend. No API key or secret is needed for this — the endpoint is
public.

Be a reasonable citizen of Tibi's server: debounce the search-as-you-type input (~300ms) so you
aren't firing a request per keystroke.

## Pages / routes

Plain multi-page static site (no client-side router needed):

- `login.html` — email/password or magic link sign-in
- `signup.html` — create account, then immediately prompt for name + Instagram handle (writes
  to `profiles`)
- `index.html` — the feed. Protected. Query `listings` where `status in ('active','sold')`,
  joined with `profiles` for name + @handle. Redirect to `login.html` if there's no session.
- `new-listing.html` — protected. Search box wired to the `search-tibi` edge function → pick a
  result → enter size → insert into `listings`.
- `my-listings.html` — protected. Shows the current user's own listings (all statuses except
  `deleted`) with buttons to flip status to sold/archived/deleted.

Every protected page should check for a Supabase session on load and redirect to `login.html`
if there isn't one. Remember: this check is a UX courtesy, not the security — RLS is.

## Config

`config.js` at the repo root holds the Supabase project URL and **anon public key**:

```js
export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
```

This file is safe to commit. The anon key is meant to be public in every Supabase client app —
RLS is what enforces access, not secrecy of this key. Do not try to hide it in an env var that a
static site can't read at runtime anyway. Never commit a Supabase *service role* key anywhere —
this project doesn't need one.

## Repo layout to produce

```
/
├── index.html
├── login.html
├── signup.html
├── new-listing.html
├── my-listings.html
├── config.js
├── css/style.css
├── js/
│   ├── supabase-client.js
│   ├── auth.js
│   ├── feed.js
│   ├── new-listing.js
│   └── my-listings.js
├── supabase/
│   ├── schema.sql
│   └── functions/search-tibi/index.ts
├── CLAUDE.md
├── SETUP.md
└── README.md
```

## Definition of done

- [ ] Logged-out visitor hitting `index.html` (or the API directly) gets no listing data
- [ ] Signup collects name + Instagram handle before letting someone post
- [ ] New-listing search hits Tibi's real catalog through the edge function, no manual entry of
      name/image/type
- [ ] Every listing card shows the lister's name + @handle
- [ ] Sold/Archived/Deleted are all just status updates — no hard deletes anywhere
- [ ] Site works as static files with no build step, ready for GitHub Pages
