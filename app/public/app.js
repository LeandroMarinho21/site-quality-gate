const CART_KEY = "nimbus-cart";

function money(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  paintCartCount();
}

function paintCartCount() {
  const el = document.querySelector("[data-testid=cart-count]");
  if (!el) return;
  const qty = readCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
  el.textContent = String(qty);
}

function addToCart(sku, qty = 1) {
  const items = readCart();
  const found = items.find((item) => item.sku === sku);
  if (found) found.qty += qty;
  else items.push({ sku, qty });
  writeCart(items);
}

async function fetchProducts() {
  const res = await fetch("/api/products");
  const data = await res.json();
  return data.products || [];
}

function productCard(p) {
  return `<li class="card" data-sku="${p.sku}" data-testid="product-${p.sku}">
    <span class="tag">${p.tag}</span>
    <h3>${p.name}</h3>
    <p>${p.blurb}</p>
    <p class="price">${money(p.price)}</p>
    <a class="btn" href="/product.html?sku=${p.sku}">Ver produto</a>
  </li>`;
}

async function renderCatalog() {
  const root = document.querySelector("[data-testid=product-list]");
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim().toLowerCase();
  const category = params.get("category") || "todos";
  const products = await fetchProducts();
  const filtered = products.filter((p) => {
    const byCat = category === "todos" || p.category === category;
    const byQ = !q || `${p.name} ${p.blurb} ${p.sku}`.toLowerCase().includes(q);
    return byCat && byQ;
  });
  const empty = document.querySelector("[data-testid=catalog-empty]");
  if (!filtered.length) {
    root.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  root.innerHTML = filtered.map(productCard).join("");
  const search = document.querySelector("[data-testid=search-input]");
  if (search && q) search.value = params.get("q");
}

async function renderProduct() {
  const root = document.querySelector("[data-testid=product-page]");
  if (!root) return;
  const sku = new URLSearchParams(location.search).get("sku");
  const res = await fetch(`/api/products/${encodeURIComponent(sku || "")}`);
  if (!res.ok) {
    root.innerHTML = "<p data-testid=product-missing>Produto não encontrado.</p>";
    return;
  }
  const p = await res.json();
  root.innerHTML = `
    <div class="swatch" data-sku="${p.sku}" aria-hidden="true"></div>
    <div>
      <p class="tag">${p.tag}</p>
      <h1 data-testid="product-name">${p.name}</h1>
      <p class="price" data-testid="product-price">${money(p.price)}</p>
      <p data-testid="product-blurb">${p.blurb}</p>
      <ul class="specs">${p.specs.map((s) => `<li>${s}</li>`).join("")}</ul>
      <p>Estoque: <span data-testid="product-stock">${p.stock}</span></p>
      <button class="btn" type="button" data-testid="add-to-cart">Adicionar à sacola</button>
      <p class="flash" hidden data-testid="added-flash">Adicionado à sacola.</p>
    </div>`;
  root.querySelector("[data-testid=add-to-cart]").addEventListener("click", () => {
    addToCart(p.sku, 1);
    const flash = root.querySelector("[data-testid=added-flash]");
    flash.hidden = false;
  });
}

async function renderCart() {
  const body = document.querySelector("[data-testid=cart-body]");
  if (!body) return;
  const products = await fetchProducts();
  const items = readCart();
  const empty = document.querySelector("[data-testid=cart-empty]");
  const table = document.querySelector("[data-testid=cart-table]");
  if (!items.length) {
    if (empty) empty.hidden = false;
    if (table) table.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (table) table.hidden = false;
  let total = 0;
  body.innerHTML = items
    .map((item) => {
      const p = products.find((prod) => prod.sku === item.sku);
      if (!p) return "";
      const line = p.price * item.qty;
      total += line;
      return `<tr data-sku="${p.sku}">
        <td>${p.name}</td>
        <td><input data-testid="qty-${p.sku}" type="number" min="1" value="${item.qty}" style="width:4rem" /></td>
        <td>${money(line)}</td>
        <td><button type="button" data-testid="remove-${p.sku}">Remover</button></td>
      </tr>`;
    })
    .join("");
  const totalEl = document.querySelector("[data-testid=cart-total]");
  if (totalEl) totalEl.textContent = money(total);

  body.querySelectorAll("input[type=number]").forEach((input) => {
    input.addEventListener("change", () => {
      const sku = input.closest("tr").dataset.sku;
      const next = readCart().map((item) =>
        item.sku === sku ? { ...item, qty: Math.max(1, Number(input.value) || 1) } : item,
      );
      writeCart(next);
      renderCart();
    });
  });
  body.querySelectorAll("button[data-testid^=remove-]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sku = btn.closest("tr").dataset.sku;
      writeCart(readCart().filter((item) => item.sku !== sku));
      renderCart();
    });
  });
}

async function bindCheckout() {
  const form = document.querySelector("[data-testid=checkout-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = document.querySelector("[data-testid=checkout-result]");
    const err = document.querySelector("[data-testid=checkout-error]");
    result.hidden = true;
    err.hidden = true;
    const items = readCart();
    const payload = {
      customer: {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        cep: form.cep.value.trim(),
      },
      items,
    };
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      err.hidden = false;
      err.textContent =
        data.error === "empty_cart"
          ? "A sacola está vazia."
          : "Não foi possível fechar o pedido. Confira nome, e-mail e CEP.";
      return;
    }
    writeCart([]);
    result.hidden = false;
    result.textContent = `Pedido ${data.order.id} confirmado para ${data.order.customer.name}. Total ${money(data.order.total)}.`;
  });
}

function bindContact() {
  const form = document.querySelector("[data-testid=contact-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name.value.trim(),
        message: form.message.value.trim(),
      }),
    });
    const data = await res.json();
    const out = document.querySelector("[data-testid=contact-result]");
    out.hidden = false;
    out.textContent = data.message || data.error;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  paintCartCount();
  renderCatalog();
  renderProduct();
  renderCart();
  bindCheckout();
  bindContact();
});
