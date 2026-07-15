import { supabase, requireSession } from "./supabase-client.js";
import { signOut } from "./auth.js";

const profileForm = document.getElementById("profile-form");
const nameInput = document.getElementById("name");
const instagramInput = document.getElementById("instagram");
const profileError = document.getElementById("profile-error");
const profileSaved = document.getElementById("profile-saved");

const savedGrid = document.getElementById("saved-grid");
const savedEmpty = document.getElementById("saved-empty");

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, instagram_handle")
    .eq("id", userId)
    .single();

  if (error) {
    profileError.textContent = `Couldn't load your profile: ${error.message}`;
    return;
  }

  nameInput.value = data.name;
  instagramInput.value = data.instagram_handle;
}

function renderSavedListing(saved) {
  const listing = saved.listings;
  const row = document.createElement("div");
  row.className = "my-listing-row";

  const img = document.createElement("img");
  img.src = listing.image_url;
  img.alt = listing.item_name;
  row.appendChild(img);

  const info = document.createElement("div");
  info.className = "info";

  const badge = document.createElement("span");
  badge.className = `status-badge ${listing.status}`;
  badge.textContent = listing.status;
  info.appendChild(badge);

  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = listing.item_name;
  info.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = [listing.item_type, listing.size ? `Size ${listing.size}` : null]
    .filter(Boolean)
    .join(" · ");
  info.appendChild(meta);

  const seller = document.createElement("div");
  seller.className = "seller";
  const sellerName = listing.profiles?.name ?? "Unknown seller";
  const handle = listing.profiles?.instagram_handle;
  seller.textContent = handle ? `${sellerName} · @${handle}` : sellerName;
  info.appendChild(seller);

  row.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "actions";
  const unsaveBtn = document.createElement("button");
  unsaveBtn.className = "secondary";
  unsaveBtn.textContent = "Unsave";
  unsaveBtn.addEventListener("click", () => unsaveListing(saved.id));
  actions.appendChild(unsaveBtn);
  row.appendChild(actions);

  return row;
}

async function unsaveListing(savedId) {
  const { error } = await supabase.from("saved_listings").delete().eq("id", savedId);
  if (error) {
    alert(`Couldn't remove saved listing: ${error.message}`);
    return;
  }
  loadSavedListings();
}

async function loadSavedListings() {
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase
    .from("saved_listings")
    .select("id, listings(*, profiles(name, instagram_handle))")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  savedGrid.innerHTML = "";

  if (error) {
    savedEmpty.textContent = `Couldn't load saved listings: ${error.message}`;
    savedEmpty.style.display = "block";
    return;
  }

  if (!data || data.length === 0) {
    savedEmpty.textContent = "You haven't saved any listings yet.";
    savedEmpty.style.display = "block";
    return;
  }

  savedEmpty.style.display = "none";
  data.forEach((saved) => savedGrid.appendChild(renderSavedListing(saved)));
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  profileError.textContent = "";
  profileSaved.textContent = "";

  const { data: { session } } = await supabase.auth.getSession();

  const { error } = await supabase
    .from("profiles")
    .update({
      name: nameInput.value,
      instagram_handle: instagramInput.value.replace(/^@/, ""),
    })
    .eq("id", session.user.id);

  if (error) {
    profileError.textContent = error.message;
    return;
  }

  profileSaved.textContent = "Saved.";
});

const session = await requireSession();
if (session) {
  document.getElementById("logout-btn").addEventListener("click", signOut);
  loadProfile(session.user.id);
  loadSavedListings();
}
