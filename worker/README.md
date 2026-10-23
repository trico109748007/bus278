# bus278-proxy（Cloudflare Worker）

把 `https://pda5284.gov.taipei/MQS/RouteDyna?routeid=…` 轉接出來並加上 CORS，讓瀏覽器裡的 PWA 可以直接讀取。

## 部署

```sh
cd worker
npx wrangler login
npx wrangler deploy
```

部署完會得到網址，例如 `https://bus278-proxy.<帳號>.workers.dev`。
把它填進 PWA 的「設定 → Worker 網址」，或直接改 `app.js` 裡的 `DEFAULT_WORKER_URL`。

也可以不裝 wrangler：在 Cloudflare 後台 Workers & Pages → Create → Hello World，
把 `src/index.js` 的內容貼上後 Deploy。

## 用法

```
GET https://bus278-proxy.<帳號>.workers.dev/?routeid=10752
```

- 只接受數字的 `routeid`，不能拿來代理其他網址。
- 上游結果在 Worker 端快取 10 秒，多人同時開不會一直打 pda5284。
- 想限制只有自己的 PWA 能用，把 `wrangler.toml` 的 `ALLOWED_ORIGINS` 改成 PWA 的網址（例如 `https://trico109748007.github.io`）。
