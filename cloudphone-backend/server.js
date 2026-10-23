import http from "node:http";

const port = Number(process.env.PORT || 10000);
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

const send = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const path = new URL(req.url || "/", "http://localhost").pathname;

  if (req.method === "GET" && (path === "/" || path === "/health" || path === "/api/health")) {
    return send(res, 200, {
      ok: true,
      service: "cloudphone-backend",
      supabaseConfigured: Boolean(supabaseUrl && supabaseKey),
      cloudAndroidProviderConfigured: Boolean(process.env.CLOUD_ANDROID_PROVIDER_URL),
      note: "A real Android cloud session requires a configured cloud Android provider."
    });
  }

  if (req.method === "GET" && path === "/api/config") {
    return send(res, 200, {
      backend: "cloudphone-backend",
      supabaseUrl: supabaseUrl || null,
      ready: Boolean(supabaseUrl && supabaseKey && process.env.CLOUD_ANDROID_PROVIDER_URL)
    });
  }

  return send(res, 404, { ok: false, error: "Endpoint not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Cloud Phone backend listening on ${port}`);
});
