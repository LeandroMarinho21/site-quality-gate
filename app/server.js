const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8080);
const VERSION = process.env.APP_VERSION || "1.0.0";
const INJECT_ERRORS = process.env.INJECT_ERRORS === "1";
const PUBLIC_DIR = path.join(__dirname, "public");

const stats = {
  requests: 0,
  errors: 0,
};

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
  res.writeHead(status, {
    "content-length": payload.length,
    ...headers,
  });
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
  return "application/octet-stream";
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

function statusPage() {
  const rate = errorRate();
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Status · Nimbus Shop</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="top">
      <a class="brand" href="/">Nimbus Shop</a>
      <nav>
        <a href="/">Home</a>
        <a href="/catalog.html">Catálogo</a>
        <a href="/contact.html">Contato</a>
        <a href="/status" aria-current="page">Status</a>
      </nav>
    </header>
    <main class="wrap">
      <h1>Métricas do canary</h1>
      <p class="lede">Valores em memória deste replica. O quality gate usa o mesmo endpoint <code>/metrics</code>.</p>
      <dl class="metrics" data-testid="metrics-panel">
        <div><dt>Versão</dt><dd data-testid="metric-version">${VERSION}</dd></div>
        <div><dt>Requests</dt><dd data-testid="metric-requests">${stats.requests}</dd></div>
        <div><dt>Erros</dt><dd data-testid="metric-errors">${stats.errors}</dd></div>
        <div><dt>Error rate</dt><dd data-testid="metric-error-rate">${rate.toFixed(4)}</dd></div>
      </dl>
    </main>
  </body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;

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

  if (route === "/checkout") {
    const status = INJECT_ERRORS ? 500 : 200;
    track(status);
    sendJson(res, status, {
      ok: !INJECT_ERRORS,
      version: VERSION,
    });
    return;
  }

  if (route === "/contact" && req.method === "POST") {
    track(200);
    sendJson(res, 200, { ok: true, message: "Recebemos seu pedido." });
    return;
  }

  let filePath = route === "/" ? "/index.html" : route;
  const abs = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!abs.startsWith(PUBLIC_DIR)) {
    track(403);
    send(res, 403, "forbidden", { "content-type": "text/plain" });
    return;
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      track(404);
      send(res, 404, "Página não encontrada", { "content-type": "text/plain; charset=utf-8" });
      return;
    }
    track(200);
    send(res, 200, data, { "content-type": mime(abs) });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  process.stdout.write(`nimbus-shop ${VERSION} listening on ${PORT}\n`);
});
