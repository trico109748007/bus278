"use strict";

// 部署好 Worker 後可以直接把網址填在這裡；也可以在畫面上的「設定」裡填。
const DEFAULT_WORKER_URL = "https://bus278-proxy.trico109748007.workers.dev";
const DEFAULT_INTERVAL = 30;
const MIN_INTERVAL = 10;

// 沿用 App Inventor 版的設定：每條路線抓一次 RouteDyna，
// 再用 Stop 清單裡第 N 個站（1 起算）的 n1 欄位，以逗號切開後第 8 個值是到站秒數。
const ROUTES = {
  "278": 10752,
  "278區": 16439,
  "74": 11833,
};

const GROUPS = [
  {
    title: "景福街",
    stops: [
      { route: "278", index: 1, name: "景福街" },
      { route: "278區", index: 1, name: "景福街" },
      { route: "74", index: 39, name: "財政園區" },
    ],
  },
  {
    title: "綜合大樓",
    stops: [
      { route: "278", index: 97, name: "綜合大樓" },
      { route: "278區", index: 68, name: "綜合大樓" },
      { route: "74", index: 24, name: "綜合大樓" },
    ],
  },
];

const SECONDS_FIELD = 8;

const $ = (id) => document.getElementById(id);
let timer = null;
let nextAt = 0;
let loading = false;

function readSetting(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 私密瀏覽等情況下存不了，就只在這次有效。
  }
}

const settings = {
  get interval() {
    const n = parseInt(readSetting("interval", DEFAULT_INTERVAL), 10);
    return Number.isFinite(n) && n >= MIN_INTERVAL ? n : DEFAULT_INTERVAL;
  },
  set interval(v) {
    writeSetting("interval", String(v));
  },
  get workerUrl() {
    const fromQuery = new URLSearchParams(location.search).get("worker");
    if (fromQuery) writeSetting("workerUrl", fromQuery);
    return (fromQuery || readSetting("workerUrl", DEFAULT_WORKER_URL) || "").trim();
  },
  set workerUrl(v) {
    writeSetting("workerUrl", v.trim());
  },
};

function render() {
  const main = $("groups");
  main.textContent = "";
  for (const group of GROUPS) {
    const section = document.createElement("section");
    const h = document.createElement("h2");
    h.textContent = group.title;
    section.appendChild(h);
    for (const stop of group.stops) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML =
        `<span class="route"></span><span class="name"></span><span class="eta">—</span>`;
      row.querySelector(".route").textContent = stop.route;
      row.querySelector(".name").textContent = stop.name;
      stop.el = row.querySelector(".eta");
      section.appendChild(row);
    }
    main.appendChild(section);
  }
}

// 台北市公車動態的到站秒數慣例：負數代表特殊狀態。
function describe(seconds) {
  if (!Number.isFinite(seconds)) return { text: "無資料", cls: "none" };
  switch (seconds) {
    case -1: return { text: "尚未發車", cls: "none" };
    case -2: return { text: "交管不停", cls: "none" };
    case -3: return { text: "末班已過", cls: "none" };
    case -4: return { text: "今日未營運", cls: "none" };
  }
  if (seconds < 0) return { text: "無資料", cls: "none" };
  if (seconds < 60) return { text: "進站中", cls: "now" };
  const min = Math.round(seconds / 60);
  return { text: `${min} 分`, cls: min <= 3 ? "soon" : "" };
}

function stopSeconds(data, index) {
  const list = data && Array.isArray(data.Stop) ? data.Stop : null;
  const item = list ? list[index - 1] : undefined;
  if (item == null) return NaN;
  const n1 = typeof item === "string" ? item : item.n1;
  if (typeof n1 !== "string") return NaN;
  const field = n1.split(",")[SECONDS_FIELD - 1];
  const n = field == null || field.trim() === "" ? NaN : Number(field);
  return Number.isFinite(n) ? n : NaN;
}

async function fetchRoute(base, routeid) {
  const url = new URL(base);
  url.searchParams.set("routeid", String(routeid));
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function refresh() {
  const base = settings.workerUrl;
  if (!base) {
    $("error").textContent = "請先到「設定」填入 Worker 網址";
    return;
  }
  if (loading) return;
  loading = true;
  $("refresh").disabled = true;
  document.body.classList.add("loading");

  const errors = [];
  const results = await Promise.all(
    Object.entries(ROUTES).map(async ([route, id]) => {
      try {
        return [route, await fetchRoute(base, id)];
      } catch (err) {
        errors.push(`${route}：${err.message}`);
        return [route, null];
      }
    }),
  );
  const byRoute = Object.fromEntries(results);

  for (const group of GROUPS) {
    for (const stop of group.stops) {
      const data = byRoute[stop.route];
      if (!data) {
        stop.el.textContent = "讀取失敗";
        stop.el.className = "eta none";
        continue;
      }
      const { text, cls } = describe(stopSeconds(data, stop.index));
      stop.el.textContent = text;
      stop.el.className = `eta ${cls}`.trim();
    }
  }

  $("updated").textContent = formatNow();
  $("error").textContent = errors.length ? `　${errors.join("、")}` : "";
  document.body.classList.remove("loading");
  $("refresh").disabled = false;
  loading = false;
}

function schedule() {
  clearInterval(timer);
  nextAt = Date.now() + settings.interval * 1000;
  timer = setInterval(tick, 1000);
  tick();
}

async function tick() {
  if (document.hidden) return;
  const left = Math.ceil((nextAt - Date.now()) / 1000);
  if (left <= 0) {
    nextAt = Date.now() + settings.interval * 1000;
    $("countdown").textContent = "更新中…";
    await refresh();
    return;
  }
  $("countdown").textContent = `${left} 秒後更新`;
}

async function refreshNow() {
  await refresh();
  schedule();
}

function setupSettings() {
  const dialog = $("settings");
  $("openSettings").addEventListener("click", () => {
    $("interval").value = settings.interval;
    $("workerUrl").value = settings.workerUrl;
    dialog.showModal();
  });
  $("cancelSettings").addEventListener("click", () => dialog.close());
  $("settingsForm").addEventListener("submit", () => {
    const n = parseInt($("interval").value, 10);
    settings.interval = Number.isFinite(n) && n >= MIN_INTERVAL ? n : DEFAULT_INTERVAL;
    settings.workerUrl = $("workerUrl").value;
    refreshNow();
  });
}

document.addEventListener("visibilitychange", () => {
  // 從背景切回來時資料多半已過期，直接重抓。
  if (!document.hidden) refreshNow();
});

$("refresh").addEventListener("click", refreshNow);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
setupSettings();
refreshNow();
