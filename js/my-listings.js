import { supabase, requireSession } from "./supabase-client.js?v=9";
import { signOut } from "./auth.js?v=9";
import { formatPrice } from "./format.js?v=9";

const listEl = document.getElementById("my-listings");
const emptyState = document.getElementById("empty-state");

async function updateStatus(listingId, status) {
  const { error } = await supabase.from("listings").update({ status }).eq("id", listingId);
  if (error) {
    alert(`Couldn't update listing: ${error.message}`);
    return;
  }
  loadMyListings();
}

function renderRow(listing) {
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

  const formattedPrice = formatPrice(listing.price, listing.currency);
  if (formattedPrice) {
    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formattedPrice + " ";
    const shipping = document.createElement("span");
    shipping.className = "shipping";
    shipping.textContent = listing.shipping_included ? "· Shipping included" : "· + shipping";
    price.appendChild(shipping);
    info.appendChild(price);
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
  info.appendChild(meta);

  if (listing.material) {
    const material = document.createElement("div");
    material.className = "material";
    material.textContent = listing.material;
    info.appendChild(material);
  }

  row.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "actions";

  if (listing.status !== "sold") {
    const soldBtn = document.createElement("button");
    soldBtn.textContent = "Mark sold";
    soldBtn.addEventListener("click", () => updateStatus(listing.id, "sold"));
    actions.appendChild(soldBtn);
  }

  if (listing.status !== "archived") {
    const archiveBtn = document.createElement("button");
    archiveBtn.className = "secondary";
    archiveBtn.textContent = "Archive";
    archiveBtn.addEventListener("click", () => updateStatus(listing.id, "archived"));
    actions.appendChild(archiveBtn);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "danger";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => {
    if (confirm("Delete this listing? It'll be hidden from the feed.")) {
      updateStatus(listing.id, "deleted");
    }
  });
  actions.appendChild(deleteBtn);

  row.appendChild(actions);
  return row;
}

async function loadMyListings() {
  const { data: { session } } = await supabase.auth.getSession();

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", session.user.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  listEl.innerHTML = "";

  if (error) {
    emptyState.textContent = `Couldn't load your listings: ${error.message}`;
    emptyState.style.display = "block";
    return;
  }

  if (!data || data.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  data.forEach((listing) => listEl.appendChild(renderRow(listing)));
}

const session = await requireSession();
if (session) {
  document.getElementById("logout-btn").addEventListener("click", signOut);
  loadMyListings();
}
