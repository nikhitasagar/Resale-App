import { supabase, requireSession } from "./supabase-client.js?v=8";
import { signOut } from "./auth.js?v=8";
import { formatPrice } from "./format.js?v=8";

const grid = document.getElementById("listing-grid");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const sizeFilter = document.getElementById("size-filter");

let allListings = [];
let savedListingIds = new Set(); // listing_id -> true
let savedRowIdByListingId = new Map(); // listing_id -> saved_listings.id
let currentUserId = null;

function populateFilterOptions(listings) {
  const types = [...new Set(listings.map((l) => l.item_type).filter(Boolean))].sort();
  const sizes = [...new Set(listings.map((l) => l.size).filter(Boolean))].sort();

  typeFilter.innerHTML = '<option value="">All types</option>';
  types.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeFilter.appendChild(opt);
  });

  sizeFilter.innerHTML = '<option value="">All sizes</option>';
  sizes.forEach((size) => {
    const opt = document.createElement("option");
    opt.value = size;
    opt.textContent = size;
    sizeFilter.appendChild(opt);
  });
}

async function toggleSave(listingId, btn) {
  if (savedListingIds.has(listingId)) {
    const savedRowId = savedRowIdByListingId.get(listingId);
    const { error } = await supabase.from("saved_listings").delete().eq("id", savedRowId);
    if (error) {
      alert(`Couldn't unsave: ${error.message}`);
      return;
    }
    savedListingIds.delete(listingId);
    savedRowIdByListingId.delete(listingId);
    btn.classList.remove("saved");
    btn.setAttribute("aria-label", "Save");
  } else {
    const { data, error } = await supabase
      .from("saved_listings")
      .insert({ user_id: currentUserId, listing_id: listingId })
      .select("id")
      .single();
    if (error) {
      alert(`Couldn't save: ${error.message}`);
      return;
    }
    savedListingIds.add(listingId);
    savedRowIdByListingId.set(listingId, data.id);
    btn.classList.add("saved");
    btn.setAttribute("aria-label", "Unsave");
  }
}

const BOOKMARK_ICON =
  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3 2h10v12l-5-3.5L3 14V2z"/></svg>';

function renderListing(listing) {
  const card = document.createElement("div");
  card.className = "listing-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";

  const img = document.createElement("img");
  img.src = listing.image_url;
  img.alt = listing.item_name;
  imageWrap.appendChild(img);

  const saveBtn = document.createElement("button");
  saveBtn.className = "save-btn";
  saveBtn.innerHTML = BOOKMARK_ICON;
  const isSaved = savedListingIds.has(listing.id);
  saveBtn.setAttribute("aria-label", isSaved ? "Unsave" : "Save");
  if (isSaved) saveBtn.classList.add("saved");
  saveBtn.addEventListener("click", () => toggleSave(listing.id, saveBtn));
  imageWrap.appendChild(saveBtn);

  card.appendChild(imageWrap);

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

  const formattedPrice = formatPrice(listing.price, listing.currency);
  if (formattedPrice) {
    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formattedPrice + " ";
    const shipping = document.createElement("span");
    shipping.className = "shipping";
    shipping.textContent = listing.shipping_included ? "· Shipping included" : "· + shipping";
    price.appendChild(shipping);
    body.appendChild(price);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = [
    listing.item_type,
    listing.size ? `Size ${listing.size}` : null,
    listing.style_number,
  ]
    .filter(Boolean)
    .join(" · ");
  body.appendChild(meta);

  if (listing.material) {
    const material = document.createElement("div");
    material.className = "material";
    material.textContent = listing.material;
    body.appendChild(material);
  }

  const seller = document.createElement("div");
  seller.className = "seller";
  const sellerName = listing.profiles?.name ?? "Unknown seller";
  const handle = listing.profiles?.instagram_handle;
  seller.textContent = handle ? `${sellerName} · @${handle}` : sellerName;
  body.appendChild(seller);

  card.appendChild(body);
  return card;
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  const size = sizeFilter.value;

  const filtered = allListings.filter((listing) => {
    if (query) {
      const haystack = [listing.item_name, listing.style_number, listing.material]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (type && listing.item_type !== type) return false;
    if (size && listing.size !== size) return false;
    return true;
  });

  grid.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.textContent = "No listings match your search/filters.";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  filtered.forEach((listing) => grid.appendChild(renderListing(listing)));
}

async function loadSavedListingIds(userId) {
  const { data, error } = await supabase
    .from("saved_listings")
    .select("id, listing_id")
    .eq("user_id", userId);

  if (error) return;

  data.forEach((row) => {
    savedListingIds.add(row.listing_id);
    savedRowIdByListingId.set(row.listing_id, row.id);
  });
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

  allListings = data ?? [];

  if (allListings.length === 0) {
    emptyState.innerHTML = 'No listings yet. <a href="new-listing.html">Post the first one.</a>';
    emptyState.style.display = "block";
    return;
  }

  populateFilterOptions(allListings);
  applyFilters();
}

const session = await requireSession();
if (session) {
  currentUserId = session.user.id;
  document.getElementById("logout-btn").addEventListener("click", signOut);

  searchInput.addEventListener("input", applyFilters);
  typeFilter.addEventListener("change", applyFilters);
  sizeFilter.addEventListener("change", applyFilters);

  await loadSavedListingIds(currentUserId);
  await loadFeed();
}
