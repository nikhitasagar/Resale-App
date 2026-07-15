import { supabase, requireSession } from "./supabase-client.js?v=4";
import { signOut } from "./auth.js?v=4";

const profileForm = document.getElementById("profile-form");
const nameInput = document.getElementById("name");
const instagramInput = document.getElementById("instagram");
const profileError = document.getElementById("profile-error");
const profileSaved = document.getElementById("profile-saved");

const savedGrid = document.getElementById("saved-grid");
const savedEmpty = document.getElementById("saved-empty");

const loginDetailsForm = document.getElementById("login-details-form");
const accountEmailInput = document.getElementById("account-email");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const loginDetailsError = document.getElementById("login-details-error");
const loginDetailsSaved = document.getElementById("login-details-saved");

const deleteAccountBtn = document.getElementById("delete-account-btn");
const confirmDeleteForm = document.getElementById("confirm-delete-form");
const deleteConfirmInput = document.getElementById("delete-confirm-input");
const deleteAccountError = document.getElementById("delete-account-error");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

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
  meta.textContent = [
    listing.item_type,
    listing.size ? `Size ${listing.size}` : null,
    listing.style_number,
  ]
    .filter(Boolean)
    .join(" · ");
  info.appendChild(meta);

  if (listing.material) {
    const material = document.createElement("div");
    material.className = "material";
    material.textContent = listing.material;
    info.appendChild(material);
  }

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

loginDetailsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginDetailsError.textContent = "";
  loginDetailsSaved.textContent = "";

  const newPassword = newPasswordInput.value;
  if (newPassword && newPassword !== confirmPasswordInput.value) {
    loginDetailsError.textContent = "Passwords don't match.";
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const updates = {};
  if (accountEmailInput.value && accountEmailInput.value !== session.user.email) {
    updates.email = accountEmailInput.value;
  }
  if (newPassword) {
    updates.password = newPassword;
  }

  if (Object.keys(updates).length === 0) {
    loginDetailsSaved.textContent = "Nothing to update.";
    return;
  }

  const { error } = await supabase.auth.updateUser(updates);
  if (error) {
    loginDetailsError.textContent = error.message;
    return;
  }

  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  loginDetailsSaved.textContent = updates.email
    ? "Saved. Check your new email address for a confirmation link."
    : "Saved.";
});

deleteAccountBtn.addEventListener("click", () => {
  deleteAccountBtn.style.display = "none";
  confirmDeleteForm.style.display = "flex";
});

cancelDeleteBtn.addEventListener("click", () => {
  confirmDeleteForm.style.display = "none";
  deleteAccountBtn.style.display = "inline-block";
  deleteConfirmInput.value = "";
  deleteAccountError.textContent = "";
});

confirmDeleteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  deleteAccountError.textContent = "";

  if (deleteConfirmInput.value !== "DELETE") {
    deleteAccountError.textContent = 'Type "DELETE" exactly to confirm.';
    return;
  }

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting…";

  const { error } = await supabase.functions.invoke("delete-account");

  if (error) {
    deleteAccountError.textContent = `Couldn't delete account: ${error.message}`;
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = "Permanently delete my account";
    return;
  }

  await supabase.auth.signOut();
  window.location.href = "login.html";
});

const session = await requireSession();
if (session) {
  document.getElementById("logout-btn").addEventListener("click", signOut);
  accountEmailInput.value = session.user.email;
  loadProfile(session.user.id);
  loadSavedListings();
}
