-- Tibi Resale Marketplace — schema + Row Level Security
-- Run this in the Supabase SQL editor (or `supabase db push`) once, on a fresh project.

-- Extends Supabase's built-in auth.users with the profile fields this app needs.
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  instagram_handle text not null,
  created_at timestamptz default now()
);

create type listing_status as enum ('active', 'sold', 'archived', 'deleted');

create table listings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references profiles(id) not null,
  shopify_product_id text not null,   -- Tibi's product handle, kept for reference/linking back
  item_name text not null,
  image_url text not null,            -- Tibi's own CDN url — never uploaded/stored by us
  item_type text,                     -- Shopify's product_type, e.g. "Dress", "Blazer"
  size text not null,                 -- the one field the lister actually types
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
