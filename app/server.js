const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const VERSION = process.env.APP_VERSION || "1.0.0";
const INJECT_ERRORS = process.env.INJECT_ERRORS === "1";
const PUBLIC_DIR = path.join(__dirname, "public");
const PRODUCTS = JSON.parse(fs.readFileSync(path.join(__dirname, "products.json"), "utf8"));

const stats = { requests: 0, errors: 0 };
const orders = [];

function errorRate() {
  if (stats.requests === 0) return 0;
  return stats.errors / stats.requests;
}

function track(status) {
  stats.requests += 1;
  if (status >= 400) stats.errors += 1;
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.from(body);
  res.writeHead(status, { "content-length": payload.length, ...headers });
  res.end(payload);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "content-type": "application/json; charset=utf-8",
  });
}

function mime(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function findProduct(sku) {
  return PRODUCTS.find((p) => p.sku === sku);
}

function chrome(active) {
  const item = (href, id, label, key) =>
    `<a href="${href}" data-testid="${id}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header">
      <div class="bar">
        <a class="brand" href="/" data-testid="brand">Nimbus Shop</a>
        <form class="search" action="/catalog.html" data-testid="search-form">
          <input name="q" type="search" placeholder="Buscar: lanterna, bota, mochila" data-testid="search-input" />
          <button type="submit">Buscar</button>
        </form>
        <a class="bag" href="/cart.html" data-testid="nav-cart">Sacola <span class="count" data-testid="cart-count">0</span></a>
      </div>
      <nav class="nav">
        ${item("/", "nav-home", "Home", "home")}
        ${item("/catalog.html", "nav-catalog", "Catálogo", "catalog")}
        ${item("/about.html", "nav-about", "Sobre", "about")}
        ${item("/contact.html", "nav-contact", "Contato", "contact")}
        ${item("/status", "nav-status", "Status", "status")}
      </nav>
    </header>`;
}

function metricsBody() {
  const rate = errorRate();
  return [
    "# HELP http_requests_total Total HTTP requests",
    "# TYPE http_requests_total counter",
    `http_requests_total ${stats.requests}`,
    "# HELP http_errors_total Total HTTP 4xx/5xx responses",
    "# TYPE http_errors_total counter",
    `http_errors_total ${stats.errors}`,
    "# HELP http_error_rate Ratio of error responses to requests",
    "# TYPE http_error_rate gauge",
    `http_error_rate ${rate.toFixed(6)}`,
    "# HELP app_info Build metadata",
    "# TYPE app_info gauge",
    `app_info{version="${VERSION}"} 1`,
    "",
  ].join("\n");
}

function pageShell(title, active, inner) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${chrome(active)}
    ${inner}
    <footer class="site-footer">
      <p>Nimbus Shop · loja de demonstração para quality gate · Release 1.0</p>
    </footer>
    <script src="/app.js" defer></script>
  </body>
</html>`;
}

function statusPage() {
  const rate = errorRate();
  return pageShell(
    "Status · Nimbus Shop",
    "status",
    `<main class="wrap">
      <h1>Saúde do replica</h1>
      <p class="lede">O canary lê o mesmo <code>/metrics</code> antes de promover o tráfego.</p>
      <dl class="metrics" data-testid="metrics-panel">
        <div><dt>Versão</dt><dd data-testid="metric-version">${VERSION}</dd></div>
        <div><dt>Requests</dt><dd data-testid="metric-requests">${stats.requests}</dd></div>
        <div><dt>Erros</dt><dd data-testid="metric-errors">${stats.errors}</dd></div>
        <div><dt>Error rate</dt><dd data-testid="metric-error-rate">${rate.toFixed(4)}</dd></div>
        <div><dt>Pedidos em memória</dt><dd data-testid="metric-orders">${orders.length}</dd></div>
      </dl>
    </main>`,
  );
}

function notFoundPage() {
  return pageShell(
    "Não encontrado · Nimbus Shop",
    "",
    `<main class="wrap">
      <h1 data-testid="not-found-title">Página não encontrada</h1>
      <p>Esse endereço não existe no catálogo. Volte ao <a href="/catalog.html">catálogo</a>.</p>
    </main>`,
  );
}

async function handleApi(req, res, route) {
  if (route === "/api/products" && req.method === "GET") {
    track(200);
    sendJson(res, 200, { products: PRODUCTS });
    return true;
  }

  const skuMatch = route.match(/^\/api\/products\/([a-z0-9-]+)$/);
  if (skuMatch && req.method === "GET") {
    const product = findProduct(skuMatch[1]);
    if (!product) {
      track(404);
      sendJson(res, 404, { error: "sku_not_found" });
      return true;
    }
    track(200);
    sendJson(res, 200, product);
    return true;
  }

  if (route === "/api/contact" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.name || !body.message) {
      track(400);
      sendJson(res, 400, { ok: false, error: "name_and_message_required" });
      return true;
    }
    track(200);
    sendJson(res, 200, { ok: true, message: `Recebemos a mensagem de ${body.name}.` });
    return true;
  }

  if (route === "/api/orders" && req.method === "POST") {
    if (INJECT_ERRORS) {
      track(500);
      sendJson(res, 500, { ok: false, error: "checkout_unavailable" });
      return true;
    }
    const body = await readBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      track(400);
      sendJson(res, 400, { ok: false, error: "empty_cart" });
      return true;
    }
    if (!body.customer || !body.customer.name || !body.customer.email || !body.customer.cep) {
      track(400);
      sendJson(res, 400, { ok: false, error: "customer_required" });
      return true;
    }
    const lines = [];
    let total = 0;
    for (const item of items) {
      const product = findProduct(item.sku);
      if (!product) {
        track(400);
        sendJson(res, 400, { ok: false, error: "unknown_sku", sku: item.sku });
        return true;
      }
      const qty = Number(item.qty) || 0;
      if (qty < 1) {
        track(400);
        sendJson(res, 400, { ok: false, error: "invalid_qty" });
        return true;
      }
      total += product.price * qty;
      lines.push({ sku: product.sku, name: product.name, qty, price: product.price });
    }
    const order = {
      id: `NB-${String(orders.length + 1).padStart(4, "0")}`,
      customer: body.customer,
      items: lines,
      total,
      version: VERSION,
    };
    orders.push(order);
    track(201);
    sendJson(res, 201, { ok: true, order });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;

  try {
    if (route === "/health") {
      sendJson(res, 200, { status: "ok", version: VERSION });
      return;
    }
    if (route === "/metrics") {
      send(res, 200, metricsBody(), {
        "content-type": "text/plain; version=0.0.4; charset=utf-8",
      });
      return;
    }
    if (route === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (route === "/status") {
      track(200);
      send(res, 200, statusPage(), { "content-type": "text/html; charset=utf-8" });
      return;
    }
    if (route === "/checkout" && req.method === "GET") {
      const status = INJECT_ERRORS ? 500 : 200;
      track(status);
      sendJson(res, status, { ok: !INJECT_ERRORS, version: VERSION });
      return;
    }
    if (await handleApi(req, res, route)) return;

    const filePath = route === "/" ? "/index.html" : route;
    const abs = path.normalize(path.join(PUBLIC_DIR, filePath));
    if (!abs.startsWith(PUBLIC_DIR)) {
      track(403);
      send(res, 403, "forbidden", { "content-type": "text/plain" });
      return;
    }
    fs.readFile(abs, (err, data) => {
      if (err) {
        track(404);
        send(res, 404, notFoundPage(), { "content-type": "text/html; charset=utf-8" });
        return;
      }
      track(200);
      send(res, 200, data, { "content-type": mime(abs) });
    });
  } catch {
    track(400);
    sendJson(res, 400, { ok: false, error: "bad_request" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`nimbus-shop ${VERSION} listening on ${PORT}\n`);
});
