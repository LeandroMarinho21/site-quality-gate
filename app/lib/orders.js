const MAX_QTY_PER_LINE = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CEP_RE = /^\d{5}-?\d{3}$/;

function fail(status, error, extra = {}) {
  return { ok: false, status, error, ...extra };
}

function normalizeCustomer(customer) {
  if (!customer || typeof customer !== "object") return null;
  return {
    name: String(customer.name || "").trim(),
    email: String(customer.email || "").trim().toLowerCase(),
    cep: String(customer.cep || "").trim(),
  };
}

function validateCustomer(raw) {
  const customer = normalizeCustomer(raw);
  if (!customer || !customer.name || !customer.email || !customer.cep) {
    return fail(400, "customer_required");
  }
  if (customer.name.length < 2) return fail(400, "invalid_name");
  if (!EMAIL_RE.test(customer.email)) return fail(400, "invalid_email");
  if (!CEP_RE.test(customer.cep)) return fail(400, "invalid_cep");
  const digits = customer.cep.replace("-", "");
  return { ok: true, customer: { ...customer, cep: `${digits.slice(0, 5)}-${digits.slice(5)}` } };
}

function mergeItems(items) {
  const bySku = new Map();
  for (const item of items) {
    const sku = String(item?.sku || "");
    const qty = Number(item?.qty);
    bySku.set(sku, (bySku.get(sku) || 0) + (Number.isFinite(qty) ? qty : NaN));
  }
  return [...bySku].map(([sku, qty]) => ({ sku, qty }));
}

function buildOrder(body, catalog) {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return fail(400, "empty_cart");

  const checked = validateCustomer(body.customer);
  if (!checked.ok) return checked;

  const lines = [];
  let total = 0;
  for (const { sku, qty } of mergeItems(items)) {
    const product = catalog.find((p) => p.sku === sku);
    if (!product) return fail(400, "unknown_sku", { sku });
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return fail(400, "invalid_qty", { sku, max: MAX_QTY_PER_LINE });
    }
    if (qty > product.stock) {
      return fail(409, "out_of_stock", { sku, name: product.name, available: product.stock });
    }
    total += product.price * qty;
    lines.push({ sku: product.sku, name: product.name, qty, price: product.price });
  }

  return { ok: true, customer: checked.customer, items: lines, total };
}

function validateContact(body) {
  const name = String(body?.name || "").trim();
  const message = String(body?.message || "").trim();
  if (!name || !message) return fail(400, "name_and_message_required");
  if (message.length > 1000) return fail(400, "message_too_long", { max: 1000 });
  return { ok: true, name, message };
}

module.exports = { buildOrder, validateCustomer, validateContact, MAX_QTY_PER_LINE };
