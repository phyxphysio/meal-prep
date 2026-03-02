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
const GITHUB_REPO = "meal-prep";
const WEEK_JSON_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/week.json`;
const WEEK_JSON_RAW = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/week.json`;

let config = loadConfig();
let weekPlan = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── GitHub persistence ────────────────────────────────────────────────────────

async function loadWeekFromGitHub() {
  try {
    const res = await fetch(`${WEEK_JSON_RAW}?t=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.plan) return;
    weekPlan = data.plan;
    renderWeek();
    const date = new Date(data.generatedAt).toLocaleDateString("en-AU", {
      weekday: "short", day: "numeric", month: "short",
    });
    showSyncStatus(`📅 Showing week generated ${date}`);
  } catch (_) {}
}

async function saveWeekToGitHub() {
  const token = localStorage.getItem("ghToken");
  if (!token) {
    showSyncStatus("⚠️ Week not shared — add a GitHub token in Settings so everyone can see this plan");
    return;
  }

  showSyncStatus("Saving…");

  const payload = JSON.stringify({ generatedAt: new Date().toISOString(), plan: weekPlan }, null, 2);
  const content = btoa(unescape(encodeURIComponent(payload)));

  // Fetch current SHA (required to update an existing file)
  let sha;
  try {
    const getRes = await fetch(WEEK_JSON_API, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (getRes.ok) sha = (await getRes.json()).sha;
  } catch (_) {}

  try {
    const putRes = await fetch(WEEK_JSON_API, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "update: new week plan",
        content,
        ...(sha && { sha }),
      }),
    });
    if (putRes.ok) {
      showSyncStatus("✅ Week saved — everyone will see this plan");
    } else {
      const err = await putRes.json().catch(() => ({}));
      showSyncStatus(`⚠️ Save failed — ${err.message || "check your token"}`);
    }
  } catch (_) {
    showSyncStatus("⚠️ Save failed — check your connection");
  }
}

function showSyncStatus(msg) {
  document.getElementById("syncStatus").textContent = msg;
}

// ── Generation ────────────────────────────────────────────────────────────────

function generateWeek() {
  const cookingDays = DAYS.filter((d) => config.cookDays[d.key] !== "out");
  const outDays = DAYS.filter((d) => config.cookDays[d.key] === "out");

  // Eligible meals per cooking day
  const dayInfo = cookingDays.map((d) => {
    const cook = config.cookDays[d.key];
    const eligible = MEALS.filter((m) => m.chef === cook || m.chef === "both");
    return { ...d, cook, eligible };
  });

  // Which days can hold a meat meal
  const meatCapableDays = dayInfo.filter((d) => d.eligible.some(isMeat));
  const target = Math.min(config.meatTarget, meatCapableDays.length);

  // Randomly pick `target` days to receive a meat meal
  const meatDayKeys = new Set(
    shuffle(meatCapableDays).slice(0, target).map((d) => d.key)
  );

  const usedMeals = new Set();
  const plan = [];

  for (const d of dayInfo) {
    const wantMeat = meatDayKeys.has(d.key);

    let pool = d.eligible.filter(
      (m) => !usedMeals.has(m.name) && (wantMeat ? isMeat(m) : !isMeat(m))
    );

    // Fallback: any unused eligible meal (e.g. not enough meat/non-meat options)
    if (pool.length === 0) {
      pool = d.eligible.filter((m) => !usedMeals.has(m.name));
    }

    const meal =
      pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;

    if (meal) usedMeals.add(meal.name);
    plan.push({ key: d.key, label: d.label, cook: d.cook, meal });
  }

  outDays.forEach((d) => {
    plan.push({ key: d.key, label: d.label, cook: "out", meal: null });
  });

  // Restore day order
  plan.sort(
    (a, b) =>
      DAYS.findIndex((d) => d.key === a.key) -
      DAYS.findIndex((d) => d.key === b.key)
  );

  weekPlan = plan;
  renderWeek();
  saveWeekToGitHub();
}

// ── Regenerate ────────────────────────────────────────────────────────────────

function regenerateDay(dayKey) {
  const entry = weekPlan.find((d) => d.key === dayKey);
  if (!entry || entry.cook === "out") return;

  // Meals already used by other days
  const usedMeals = new Set(
    weekPlan
      .filter((d) => d.meal && d.key !== dayKey)
      .map((d) => d.meal.name)
  );

  const cook = config.cookDays[dayKey];
  const pool = MEALS.filter(
    (m) =>
      (m.chef === cook || m.chef === "both") &&
      !usedMeals.has(m.name) &&
      m.name !== entry.meal?.name // exclude current meal
  );

  if (pool.length === 0) return;

  entry.meal = pool[Math.floor(Math.random() * pool.length)];
  renderWeek();
}

// ── Copy to clipboard ─────────────────────────────────────────────────────────

function copyWeek() {
  if (weekPlan.length === 0) return;

  const lines = weekPlan.map((d) => {
    if (d.cook === "out") return `${d.label}: Eat out 🍽️`;
    if (!d.meal) return `${d.label}: No meal available`;
    const chef = d.cook === "chi" ? "Chi" : "Liam";
    const meatTag = isMeat(d.meal) ? " 🥩" : "";
    return `${d.label}: ${d.meal.name}${meatTag} (${chef})`;
  });

  navigator.clipboard.writeText(lines.join("\n")).then(() => {
    const btn = document.getElementById("copyBtn");
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = "📋 Copy Week"), 2000);
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderWeek() {
  const container = document.getElementById("weekDisplay");
  container.innerHTML = "";

  weekPlan.forEach((entry) => {
    const card = document.createElement("div");
    card.className = `day-card${entry.cook === "out" ? " day-out" : ""}`;

    if (entry.cook === "out") {
      card.innerHTML = `
        <div class="day-header">
          <span class="day-label">${entry.label}</span>
          <span class="chef-badge out">Eat out</span>
        </div>
        <div class="meal-name">🍽️ Enjoy your night off</div>`;
    } else {
      const meatTag =
        entry.meal && isMeat(entry.meal)
          ? " <span title='Meat meal'>🥩</span>"
          : "";
      const chefName = entry.cook === "chi" ? "Chi" : "Liam";
      card.innerHTML = `
        <div class="day-header">
          <span class="day-label">${entry.label}</span>
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

// ── Config ────────────────────────────────────────────────────────────────────

function renderConfig() {
  const meatInput = document.getElementById("meatTarget");
  meatInput.value = config.meatTarget;
  meatInput.addEventListener("change", () => {
    config.meatTarget = Math.max(0, parseInt(meatInput.value, 10) || 0);
    saveConfig();
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
      { value: "chi", label: "Chi" },
      { value: "liam", label: "Liam" },
      { value: "out", label: "Eat out" },
    ].forEach(({ value, label: text }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      opt.selected = config.cookDays[d.key] === value;
      select.appendChild(opt);
    });

    select.addEventListener("change", () => {
      config.cookDays[d.key] = select.value;
      saveConfig();
    });

    row.appendChild(label);
    row.appendChild(select);
    daysContainer.appendChild(row);
  });

  // GitHub token (stored in localStorage, only needed by the generator)
  const configBody = document.querySelector(".config-body");
  const tokenDiv = document.createElement("div");
  tokenDiv.innerHTML = `
    <div class="config-divider"></div>
    <div class="config-row">
      <label for="ghToken">🔑 GitHub token</label>
      <input type="password" id="ghToken" placeholder="ghp_…" autocomplete="off" />
    </div>
    <p class="config-hint">Lets you save the week so anyone can see it. Viewers don't need one. <a href="https://github.com/settings/tokens/new?scopes=repo&description=meal-prep" target="_blank" rel="noopener">Create token →</a></p>`;
  configBody.appendChild(tokenDiv);

  const tokenInput = document.getElementById("ghToken");
  tokenInput.value = localStorage.getItem("ghToken") || "";
  tokenInput.addEventListener("change", () => {
    const val = tokenInput.value.trim();
    if (val) localStorage.setItem("ghToken", val);
    else localStorage.removeItem("ghToken");
  });
}

function loadConfig() {
  try {
    const saved = localStorage.getItem("mealPrepConfig");
    if (saved) {
      const p = JSON.parse(saved);
      return {
        cookDays: { ...DEFAULT_CONFIG.cookDays, ...p.cookDays },
        meatTarget:
          p.meatTarget !== undefined ? p.meatTarget : DEFAULT_CONFIG.meatTarget,
      };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG, cookDays: { ...DEFAULT_CONFIG.cookDays } };
}

function saveConfig() {
  localStorage.setItem("mealPrepConfig", JSON.stringify(config));
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  renderConfig();
  loadWeekFromGitHub();
  document.getElementById("generateBtn").addEventListener("click", generateWeek);
  document.getElementById("copyBtn").addEventListener("click", copyWeek);
});
