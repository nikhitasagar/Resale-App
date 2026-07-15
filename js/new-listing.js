import { supabase, requireSession } from "./supabase-client.js";
import { signOut } from "./auth.js";

const searchInput = document.getElementById("search-input");
const resultsEl = document.getElementById("search-results");
const selectedEl = document.getElementById("selected-product");
const sizeForm = document.getElementById("size-form");
const sizeInput = document.getElementById("size-input");
const errorEl = document.getElementById("error");

let selectedProduct = null;
let debounceTimer = null;

function renderResults(products) {
  resultsEl.innerHTML = "";
  products.forEach((product) => {
    const row = document.createElement("div");
    row.className = "search-result";

    const img = document.createElement("img");
    img.src = product.image_url ?? "";
    img.alt = product.item_name;
    row.appendChild(img);

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = product.item_name;
    info.appendChild(name);

    const type = document.createElement("div");
    type.className = "type";
    type.textContent = product.item_type ?? "";
    info.appendChild(type);

    row.appendChild(info);
    row.addEventListener("click", () => selectProduct(product));
    resultsEl.appendChild(row);
  });
}

function selectProduct(product) {
  selectedProduct = product;
  resultsEl.innerHTML = "";
  searchInput.value = "";

  selectedEl.innerHTML = "";
  selectedEl.style.display = "flex";

  const img = document.createElement("img");
  img.src = product.image_url ?? "";
  img.alt = product.item_name;
  selectedEl.appendChild(img);

  const info = document.createElement("div");
  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = product.item_name;
  info.appendChild(name);
  const type = document.createElement("div");
  type.className = "meta";
  type.textContent = product.item_type ?? "";
  info.appendChild(type);
  selectedEl.appendChild(info);

  sizeForm.style.display = "flex";
}

async function runSearch(query) {
  const { data, error } = await supabase.functions.invoke("search-products", {
    body: { q: query },
  });

  if (error) {
    errorEl.textContent = `Search failed: ${error.message}`;
    return;
  }

  renderResults(data ?? []);
}

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();
  errorEl.textContent = "";

  if (query.length === 0) {
    resultsEl.innerHTML = "";
    return;
  }

  debounceTimer = setTimeout(() => runSearch(query), 300);
});

sizeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const { data: { session } } = await supabase.auth.getSession();

  const { error } = await supabase.from("listings").insert({
    seller_id: session.user.id,
    shopify_product_id: selectedProduct.shopify_product_id,
    item_name: selectedProduct.item_name,
    image_url: selectedProduct.image_url,
    item_type: selectedProduct.item_type,
    size: sizeInput.value,
  });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  window.location.href = "index.html";
});

const session = await requireSession();
if (session) {
  document.getElementById("logout-btn").addEventListener("click", signOut);
}
