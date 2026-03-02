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
  document.getElementById("generateBtn").addEventListener("click", generateWeek);
  document.getElementById("copyBtn").addEventListener("click", copyWeek);
});
