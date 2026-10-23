# bus278

278／278區／74 公車到站時間。原本是 App Inventor 專案（`src/`、`youngandroidproject/`），現在多了一個可以加到手機主畫面的 PWA 版。

## PWA

- 顯示 6 組到站時間（路線與站牌沿用 App Inventor 版）：
  - 景福街：278、278區、74（財政園區）
  - 綜合大樓：278、278區、74
- 每 30 秒自動更新，秒數可在「設定」裡改（最少 10 秒）；切回 App 時會立刻重抓。
- 資料透過 Cloudflare Worker（`worker/`）轉接 `pda5284.gov.taipei/MQS/RouteDyna?routeid=…`。

| 路線 | routeid | 站序（Stop 清單，1 起算） |
|------|---------|---------------------------|
| 278  | 10752   | 景福街 1、綜合大樓 97 |
| 278區 | 16439  | 景福街 1、綜合大樓 68 |
| 74   | 11833   | 財政園區 39、綜合大樓 24 |

到站秒數取自該站 `n1` 欄位以逗號切開後的第 8 個值，和 App Inventor 版一樣。站序若因路線調整而變動，改 `app.js` 的 `GROUPS` 即可。

### 使用步驟

1. 部署 Worker：見 [`worker/README.md`](worker/README.md)。
2. 把這個 repo 放上任何 HTTPS 靜態主機，例如 GitHub Pages（Settings → Pages → Deploy from branch → `main` / root）。
3. 打開網頁，到「設定」填 Worker 網址（或開一次 `…/?worker=https://bus278-proxy.xxx.workers.dev` 就會記住；也可以直接寫進 `app.js` 的 `DEFAULT_WORKER_URL`）。
4. 手機瀏覽器選「加到主畫面」。
