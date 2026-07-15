# Setup — do this before/alongside Claude Code

Claude Code can write all the code and run CLI commands on your machine, but it can't sign up
for accounts through a browser. These steps need you.

## 1. Create a free Supabase project
- Go to supabase.com → New project → pick a region → Free tier (no credit card needed)
- Once it's created, go to **Project Settings → API** and copy:
  - the **Project URL**
  - the **anon public** key
  (You'll paste both into `config.js` — see CLAUDE.md, this key is meant to be public.)

## 2. Install the Supabase CLI
```
npm install -g supabase
supabase login
```
This opens a browser once for auth — after that, Claude Code can run `supabase` commands for
you (deploying the edge function, pushing schema changes, etc.).

## 3. Run the schema
Easiest path for v1: open your Supabase project → **SQL Editor** → paste the contents of
`supabase/schema.sql` → Run.
(Alternatively, once the CLI is linked to your project with `supabase link --project-ref <ref>`,
Claude Code can run `supabase db push` for you.)

## 4. Create the GitHub repo
```
gh auth login          # one-time, opens a browser
gh repo create resale-app --public --source=. --push
```
If you don't have the `gh` CLI, just create a public repo on github.com and push manually —
Pages requires the repo to be public on a free personal GitHub account.

## 5. Enable GitHub Pages
Repo → Settings → Pages → Source: deploy from the `main` branch, root folder. Since this is a
plain static site with no build step, there's nothing else to configure.

## 6. Fill in config.js
After Claude Code scaffolds the project, put your real Supabase URL and anon key into
`config.js` at the repo root.

---

## Kickoff prompt — paste this as your first message to Claude Code

```
Read CLAUDE.md in this repo and follow it exactly — it's the full project spec.
supabase/schema.sql and supabase/functions/search-products/index.ts already contain the canonical
SQL and edge function code; use them as-is unless something needs fixing.

Please:
1. Scaffold the repo layout described in CLAUDE.md: plain HTML/CSS/vanilla JS, no build
   tooling, using the Supabase JS client via ESM CDN import.
2. Build login.html and signup.html (signup should immediately prompt for name + Instagram
   handle and write to the profiles table).
3. Build index.html as the protected feed: query listings (status active/sold) joined with
   profiles, show image, item name, size, type, and the lister's name + @handle. Redirect to
   login.html if there's no active session.
4. Build new-listing.html: a debounced search box that calls the search-products edge function,
   lets the user pick a result, then collects the size, then inserts a row into listings.
5. Build my-listings.html: show the current user's own listings with buttons to set status to
   sold / archived / deleted (all just UPDATE statements — never a real delete).
6. Add config.js at the repo root with placeholder SUPABASE_URL / SUPABASE_ANON_KEY values and
   a comment explaining it's safe to commit.
7. Once the schema is live in my Supabase project, deploy the edge function with
   `supabase functions deploy search-products --no-verify-jwt`.

Ask me for anything you're missing (like whether the schema has been run yet) rather than
guessing.
```
