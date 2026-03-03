const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const DEFAULT_CONFIG = {
  cookDays: {
    mon: "chi",
    tue: "liam",
    wed: "chi",
    thu: "liam",
    fri: "chi",
    sat: "out",
    sun: "chi",
  },
  meatTarget: 2,
};

const GITHUB_OWNER = "phyxphysio";
const GITHUB_REPO  = "meal-prep";
const WEEK_API   = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/week.json`;
const CONFIG_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/config.json`;
const WEEK_RAW   = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/week.json`;
const CONFIG_RAW = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/config.json`;

let config   = { ...DEFAULT_CONFIG, cookDays: { ...DEFAULT_CONFIG.cookDays } };
let weekPlan = [];
let _sessionToken = ""; // session-only, never persisted

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMeat(meal) {
  return /chicken|beef|salmon/i.test(meal.name);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentWeekDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  const map = {};
  DAYS.forEach((d, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    map[d.key] = date;
  });
  return map;
}

function formatDate(date) {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ── Token (session-only) ──────────────────────────────────────────────────────

function getToken() {
  return _sessionToken || localStorage.getItem("ghToken") || "";
}

function setToken(val) {
  _sessionToken = val.trim();
  if (_sessionToken) localStorage.setItem("ghToken", _sessionToken);
  else localStorage.removeItem("ghToken");
  updateGenerateBtn();
}

function updateGenerateBtn() {
  const btn = document.getElementById("generateBtn");
  const hasToken = !!getToken();
  btn.disabled = !hasToken;
  btn.title = hasToken ? "" : "Add a GitHub token in Settings to enable generating";
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

async function ghGet(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function ghPut(url, payload, sha) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
  return fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `update: ${url.includes("week") ? "week plan" : "config"}`,
      content,
      ...(sha && { sha }),
    }),
  });
}

// ── Config ────────────────────────────────────────────────────────────────────

async function loadConfigFromGitHub() {
  try {
    const res = await fetch(`${CONFIG_RAW}?t=${Date.now()}`);
    if (!res.ok) return null;
    return res.json();
  } catch (_) { return null; }
}

async function saveConfigToGitHub() {
  showSyncStatus("Saving config…", "info");
  const existing = await ghGet(CONFIG_API);
  try {
    const res = await ghPut(CONFIG_API, config, existing?.sha);
    if (res.ok) {
      showSyncStatus("✅ Config saved", "ok");
    } else {
      const err = await res.json().catch(() => ({}));
      showSyncStatus(`⚠️ Config save failed — ${err.message || "check your token"}`, "warn");
    }
  } catch (_) {
    showSyncStatus("⚠️ Config save failed — check your connection", "warn");
  }
}

function applyConfigToUI() {
  const meatInput = document.getElementById("meatTarget");
  if (meatInput) meatInput.value = config.meatTarget;
  document.querySelectorAll("[data-day]").forEach((select) => {
    select.value = config.cookDays[select.dataset.day] || "out";
  });
}

function renderConfig() {
  const meatInput = document.getElementById("meatTarget");
  meatInput.value = config.meatTarget;
  meatInput.addEventListener("change", () => {
    config.meatTarget = Math.max(0, parseInt(meatInput.value, 10) || 0);
  });

  const daysContainer = document.getElementById("configDays");
  DAYS.forEach((d) => {
    const row = document.createElement("div");
    row.className = "config-day-row";

    const label = document.createElement("label");
    label.textContent = d.label;

    const select = document.createElement("select");
    select.dataset.day = d.key;
    [
      { value: "chi",  label: "Chi" },
      { value: "liam", label: "Liam" },
      { value: "out",  label: "Eat out" },
    ].forEach(({ value, label: text }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      opt.selected = config.cookDays[d.key] === value;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => {
      config.cookDays[d.key] = select.value;
    });

    row.appendChild(label);
    row.appendChild(select);
    daysContainer.appendChild(row);
  });

  const configBody = document.querySelector(".config-body");
  const extra = document.createElement("div");
  extra.innerHTML = `
    <div class="config-divider"></div>
    <div class="config-row">
      <label for="ghToken">🔑 GitHub token</label>
      <input type="password" id="ghToken" placeholder="ghp_…" autocomplete="off" />
    </div>
    <p class="config-hint">Required to generate &amp; save the week. Viewers don't need one.
      <a href="https://github.com/settings/tokens/new?scopes=repo&description=meal-prep" target="_blank" rel="noopener">Create token →</a></p>
    <div class="config-divider"></div>
    <button id="saveConfigBtn" class="btn-save-config">💾 Save Config</button>`;
  configBody.appendChild(extra);

  const tokenInput = document.getElementById("ghToken");
  tokenInput.value = localStorage.getItem("ghToken") || "";
  tokenInput.addEventListener("input", () => setToken(tokenInput.value));

  document.getElementById("saveConfigBtn").addEventListener("click", saveConfigToGitHub);
}

// ── Week ──────────────────────────────────────────────────────────────────────

async function loadWeekFromGitHub() {
  try {
    const res = await fetch(`${WEEK_RAW}?t=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.plan) return;
    weekPlan = data.plan;
    renderWeek();
    const date = new Date(data.generatedAt).toLocaleDateString("en-AU", {
      weekday: "short", day: "numeric", month: "short",
    });
    showSyncStatus(`📅 Showing week generated ${date}`, "info");
  } catch (_) {}
}

async function saveWeekToGitHub() {
  showSyncStatus("Saving…", "info");
  const existing = await ghGet(WEEK_API);
  try {
    const res = await ghPut(WEEK_API, { generatedAt: new Date().toISOString(), plan: weekPlan }, existing?.sha);
    if (res.ok) {
      showSyncStatus("✅ Week saved — everyone will see this plan", "ok");
    } else {
      const err = await res.json().catch(() => ({}));
      showSyncStatus(`⚠️ Save failed — ${err.message || "check your token"}`, "warn");
    }
  } catch (_) {
    showSyncStatus("⚠️ Save failed — check your connection", "warn");
  }
}

// ── Generation ────────────────────────────────────────────────────────────────

function generateWeek() {
  if (!getToken()) return;

  const dates = currentWeekDates();
  const cookingDays = DAYS.filter((d) => config.cookDays[d.key] !== "out");
  const outDays     = DAYS.filter((d) => config.cookDays[d.key] === "out");

  const dayInfo = cookingDays.map((d) => ({
    ...d,
    cook: config.cookDays[d.key],
    eligible: MEALS.filter((m) => m.chef === config.cookDays[d.key] || m.chef === "both"),
    date: dates[d.key],
  }));

  const meatCapableDays = dayInfo.filter((d) => d.eligible.some(isMeat));
  const target = Math.min(config.meatTarget, meatCapableDays.length);
  const meatDayKeys = new Set(shuffle(meatCapableDays).slice(0, target).map((d) => d.key));

  const usedMeals = new Set();
  const plan = [];

  for (const d of dayInfo) {
    const wantMeat = meatDayKeys.has(d.key);
    let pool = d.eligible.filter(
      (m) => !usedMeals.has(m.name) && (wantMeat ? isMeat(m) : !isMeat(m))
    );
    if (pool.length === 0) pool = d.eligible.filter((m) => !usedMeals.has(m.name));

    const meal = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    if (meal) usedMeals.add(meal.name);
    plan.push({ key: d.key, label: d.label, cook: d.cook, meal, date: d.date.toISOString() });
  }

  outDays.forEach((d) => {
    plan.push({ key: d.key, label: d.label, cook: "out", meal: null, date: dates[d.key].toISOString() });
  });

  plan.sort((a, b) =>
    DAYS.findIndex((d) => d.key === a.key) - DAYS.findIndex((d) => d.key === b.key)
  );

  weekPlan = plan;
  renderWeek();
  saveWeekToGitHub();
}

// ── Regenerate ────────────────────────────────────────────────────────────────

function regenerateDay(dayKey) {
  const entry = weekPlan.find((d) => d.key === dayKey);
  if (!entry || entry.cook === "out") return;

  const usedMeals = new Set(
    weekPlan.filter((d) => d.meal && d.key !== dayKey).map((d) => d.meal.name)
  );
  const cook = config.cookDays[dayKey];
  const pool = MEALS.filter(
    (m) =>
      (m.chef === cook || m.chef === "both") &&
      !usedMeals.has(m.name) &&
      m.name !== entry.meal?.name
  );

  if (pool.length === 0) return;
  entry.meal = pool[Math.floor(Math.random() * pool.length)];
  renderWeek();
  saveWeekToGitHub();
}

// ── Copy to clipboard ─────────────────────────────────────────────────────────

function copyWeek() {
  if (weekPlan.length === 0) return;

  const lines = weekPlan.map((d) => {
    const dateStr = d.date ? ` (${formatDate(new Date(d.date))})` : "";
    if (d.cook === "out") return `${d.label}${dateStr}: Eat out 🍽️`;
    if (!d.meal) return `${d.label}${dateStr}: No meal available`;
    const chef = d.cook === "chi" ? "Chi" : "Liam";
    const meatTag = isMeat(d.meal) ? " 🥩" : "";
    return `${d.label}${dateStr}: ${d.meal.name}${meatTag} (${chef})`;
  });

  navigator.clipboard.writeText(lines.join("\n")).then(() => {
    const btn = document.getElementById("copyBtn");
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = "📋 Copy Week"), 2000);
  });
}

// ── Status banner ─────────────────────────────────────────────────────────────

function showSyncStatus(msg, type = "info") {
  const el = document.getElementById("syncStatus");
  el.textContent = msg;
  el.className = `sync-status sync-status--${type}`;
  el.style.display = msg ? "block" : "none";
}

// ── Render week ───────────────────────────────────────────────────────────────

function renderWeek() {
  const container = document.getElementById("weekDisplay");
  container.innerHTML = "";

  const todayStr = new Date().toDateString();

  weekPlan.forEach((entry) => {
    const card = document.createElement("div");
    const entryDate = entry.date ? new Date(entry.date) : null;
    const isToday = entryDate && entryDate.toDateString() === todayStr;

    card.className = [
      "day-card",
      entry.cook === "out" ? "day-out" : "",
      isToday ? "day-today" : "",
    ].filter(Boolean).join(" ");

    const dateLabel = entryDate
      ? `<span class="day-date">${formatDate(entryDate)}${isToday ? " · Today" : ""}</span>`
      : "";

    if (entry.cook === "out") {
      card.innerHTML = `
        <div class="day-header">
          <span class="day-label">${entry.label}</span>
          ${dateLabel}
          <span class="chef-badge out">Eat out</span>
        </div>
        <div class="meal-name">🍽️ Enjoy your night off</div>`;
    } else {
      const meatTag = entry.meal && isMeat(entry.meal) ? " <span title='Meat meal'>��</span>" : "";
      const chefName = entry.cook === "chi" ? "Chi" : "Liam";
      card.innerHTML = `
        <div class="day-header">
          <span class="day-label">${entry.label}</span>
          ${dateLabel}
          <span class="chef-badge ${entry.cook}">${chefName}</span>
        </div>
        <div class="meal-name">${entry.meal ? entry.meal.name : "—"}${meatTag}</div>
        <button class="regen-btn" data-day="${entry.key}">↻ Regenerate</button>`;
    }

    container.appendChild(card);
  });

  container.querySelectorAll(".regen-btn").forEach((btn) => {
    btn.addEventListener("click", () => regenerateDay(btn.dataset.day));
  });

  document.getElementById("copyWrapper").style.display = "block";
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  renderConfig();
  updateGenerateBtn();

  const remoteConfig = await loadConfigFromGitHub();
  if (remoteConfig) {
    config = {
      cookDays: { ...DEFAULT_CONFIG.cookDays, ...remoteConfig.cookDays },
      meatTarget: remoteConfig.meatTarget ?? DEFAULT_CONFIG.meatTarget,
    };
    applyConfigToUI();
  }

  await loadWeekFromGitHub();

  document.getElementById("generateBtn").addEventListener("click", generateWeek);
  document.getElementById("copyBtn").addEventListener("click", copyWeek);
});
