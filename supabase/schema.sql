-- Resale App — schema + Row Level Security
-- Run this in the Supabase SQL editor (or `supabase db push`) once, on a fresh project.

-- Extends Supabase's built-in auth.users with the profile fields this app needs.
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  instagram_handle text not null,
  created_at timestamptz default now()
);

create type listing_status as enum ('active', 'sold', 'archived', 'deleted');

-- `on delete cascade` here is deliberate: it's what makes account deletion (a user closing
-- their own account) a real hard delete of their data, distinct from the listing-level soft
-- delete below — those are different concerns (see "Account deletion" further down).
create table listings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references profiles(id) on delete cascade not null,
  shopify_product_id text not null,   -- the storefront's product handle, kept for reference/linking back
  item_name text not null,
  image_url text not null,            -- the storefront's own CDN url — never uploaded/stored by us
  item_type text,                     -- Shopify's product_type, e.g. "Dress", "Blazer"
  style_number text,                  -- e.g. "T000TW8013", parsed from the product description
  material text,                      -- e.g. "53% Polyester, 43% Wool, 4% Elastane", parsed too
  size text not null,                 -- the one field the lister actually types
  price numeric(10, 2),                -- the lister's asking price; nullable only so existing
                                       -- rows survive this migration — new listings require it
  currency text not null default 'USD',
  shipping_included boolean not null default false,
  status listing_status not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Keep updated_at current on every change.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger listings_set_updated_at
  before update on listings
  for each row execute procedure set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — this is the actual access-control boundary (req #9/#10)
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table listings enable row level security;

-- Logged-in users can view any profile (needed to show name + @handle on listings).
-- Logged-out (anon) requests get nothing back.
create policy "authenticated can view profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

-- Users can only create/update their own profile row.
create policy "users manage own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Logged-in users can view listings. Logged-out requests get nothing back — this is what
-- makes requirement #10 hold even if someone calls the Supabase API directly.
create policy "authenticated can view listings"
  on listings for select
  using (auth.role() = 'authenticated');

-- Users can only create listings under their own seller_id.
create policy "users insert own listings"
  on listings for insert
  with check (auth.uid() = seller_id);

-- Users can only update (mark sold/archived/deleted) their own listings.
-- Note: there is deliberately no delete policy — deletion is always a status update,
-- never a real DELETE, so soft-delete (req #8) is enforced structurally.
create policy "users update own listings"
  on listings for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- ---------------------------------------------------------------------------
-- Saved listings — lets a user bookmark a listing to find it again from their profile
-- ---------------------------------------------------------------------------

create table saved_listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  listing_id uuid references listings(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user_id, listing_id)
);

alter table saved_listings enable row level security;

-- A saved listing is private to the user who saved it — no policy grants any other
-- user select/insert/delete access to someone else's saved_listings rows.
create policy "users manage own saved listings"
  on saved_listings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
