import { supabase, requireSession } from "./supabase-client.js";
import { signOut } from "./auth.js";

const grid = document.getElementById("listing-grid");
const emptyState = document.getElementById("empty-state");

function renderListing(listing) {
  const card = document.createElement("div");
  card.className = "listing-card";

  const img = document.createElement("img");
  img.src = listing.image_url;
  img.alt = listing.item_name;
  card.appendChild(img);

  const body = document.createElement("div");
  body.className = "listing-body";

  const badge = document.createElement("span");
  badge.className = `status-badge ${listing.status}`;
  badge.textContent = listing.status;
  body.appendChild(badge);

  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = listing.item_name;
  body.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = [listing.item_type, listing.size ? `Size ${listing.size}` : null]
    .filter(Boolean)
    .join(" · ");
  body.appendChild(meta);

  const seller = document.createElement("div");
  seller.className = "seller";
  const sellerName = listing.profiles?.name ?? "Unknown seller";
  const handle = listing.profiles?.instagram_handle;
  seller.textContent = handle ? `${sellerName} · @${handle}` : sellerName;
  body.appendChild(seller);

  card.appendChild(body);
  return card;
}

async function loadFeed() {
  const { data, error } = await supabase
    .from("listings")
    .select("*, profiles(name, instagram_handle)")
    .in("status", ["active", "sold"])
    .order("created_at", { ascending: false });

  if (error) {
    emptyState.textContent = `Couldn't load listings: ${error.message}`;
    emptyState.style.display = "block";
    return;
  }

  if (!data || data.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  data.forEach((listing) => grid.appendChild(renderListing(listing)));
}

const session = await requireSession();
if (session) {
  document.getElementById("logout-btn").addEventListener("click", signOut);
  loadFeed();
}
