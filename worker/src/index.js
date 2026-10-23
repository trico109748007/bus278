// Cloudflare Worker：轉接台北市公車動態 RouteDyna，補上 CORS 讓 PWA 可以直接呼叫。
//
//   GET /?routeid=10752        → https://pda5284.gov.taipei/MQS/RouteDyna?routeid=10752
//   GET /RouteDyna?routeid=... → 同上
//
// 只接受數字 routeid，避免被當成任意網址的開放代理。

const UPSTREAM = "https://pda5284.gov.taipei/MQS/RouteDyna";
const CACHE_SECONDS = 10;

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return json({ error: "method not allowed" }, 405, cors);
    }

    const url = new URL(request.url);
    const routeid = url.searchParams.get("routeid") || "";
    if (!/^\d{1,8}$/.test(routeid)) {
      return json({ error: "routeid 必須是數字" }, 400, cors);
    }

    const target = `${UPSTREAM}?routeid=${routeid}`;
    const cache = caches.default;
    const cacheKey = new Request(target);

    let upstream = await cache.match(cacheKey);
    if (!upstream) {
      try {
        upstream = await fetch(target, {
          headers: {
            "User-Agent": "Mozilla/5.0 (bus278 PWA proxy)",
            Accept: "application/json, text/plain, */*",
          },
          cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
        });
      } catch (err) {
        return json({ error: "無法連線到 pda5284", detail: String(err) }, 502, cors);
      }
      if (!upstream.ok) {
        return json({ error: `pda5284 回應 ${upstream.status}` }, 502, cors);
      }
      upstream = new Response(upstream.body, upstream);
      upstream.headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
      ctx.waitUntil(cache.put(cacheKey, upstream.clone()));
    }

    const headers = new Headers(cors);
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Cache-Control", "no-store");
    return new Response(upstream.body, { status: 200, headers });
  },
};

function corsHeaders(request, env) {
  // ALLOWED_ORIGINS（wrangler.toml 的 vars）可設成逗號分隔的來源清單；沒設就允許所有來源。
  const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  let allow = "*";
  if (!allowed.includes("*")) {
    allow = allowed.includes(origin) ? origin : allowed[0];
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
