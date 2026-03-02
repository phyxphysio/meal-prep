# Meal Prep App

A mobile-first meal planning app hosted on GitHub Pages. Generates a week of meals, respects who cooks on which day, and targets a configurable number of meat meals per week.

## Live App

**https://phyxphysio.github.io/meal-prep**

---

## How it works

```
Apple Note "Meal Database"
        │
        ▼  sync_meals.applescript  (runs daily via launchd)
  meals.js  ──► git commit + push
        │
        ▼
  GitHub Pages  (index.html)
```

---

## Setup

### 1. GitHub Pages

The repo is already configured. GitHub Pages serves from the `main` branch root.

To re-enable Pages if needed:

```bash
gh api repos/phyxphysio/meal-prep/pages \
  -X POST \
  -F "source[branch]=main" \
  -F "source[path]=/"
```

### 2. Apple Note

Create a note in Apple Notes named **exactly** `Meal Database`.

Add one meal per line in this format:

```
Malaysian Satay Supreme - liam
Chicken Salad Surprise - liam
Lovely Quiche Lorraine - liam
Beef Burger Bonanza - liam
Thai Green Curry Galore - liam
Asian Noodle Salad - chi
Buddha Bowls - chi
Falafel Wraps - chi
Poke Bowls - chi
Mexican Nut Mince - chi
Paneer Curry - chi
Peanut Stew - chi
Fritters - chi
Moroccan Tagine - chi
Vege Burgers - chi
Pasta Verde - chi
Soup - chi
Kung Pao Tofu - chi
```

**Rules:**
- Chef must be `liam`, `chi`, or `both` (case-insensitive)
- Lines starting with `--` or `//` are ignored (comments)
- Meals with `chicken`, `beef`, or `salmon` in their name count as meat meals

### 3. Daily sync (launchd)

Install the launchd agent so the note is synced to the repo every day at 8am:

```bash
cp com.mealprep.sync.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.mealprep.sync.plist
```

**Run sync manually:**
```bash
osascript sync_meals.applescript
```

**View sync logs:**
```bash
cat ~/Library/Logs/mealprep-sync.log
```

**Uninstall:**
```bash
launchctl unload ~/Library/LaunchAgents/com.mealprep.sync.plist
rm ~/Library/LaunchAgents/com.mealprep.sync.plist
```

---

## App features

| Feature | Description |
|---------|-------------|
| **Generate Week** | Assigns meals Mon–Sun based on cook-day config and meat target |
| **Settings** | Configure who cooks each day (Chi / Liam / Eat out) + meat meal target |
| **↻ Regenerate** | Swap a single day's meal for another eligible unused meal |
| **Copy Week** | Copies the full week plan to clipboard as formatted text |

Config is saved in `localStorage` — settings persist between visits.

---

## File overview

| File | Purpose |
|------|---------|
| `index.html` | App shell |
| `style.css` | Mobile-first styles |
| `app.js` | Generation logic, regenerate, copy |
| `meals.js` | Meal data — **auto-updated by sync, do not edit manually** |
| `parse_note.py` | Parses Apple Note text → `meals.js` |
| `sync_meals.applescript` | Reads note, runs parser, git pushes |
| `com.mealprep.sync.plist` | launchd agent definition (daily 8am) |
