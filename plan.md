# Meal Prep App — Plan

## Problem
Build a static meal prep web app hosted on GitHub Pages. Meal data is sourced from an Apple Note ("Meal Database") and synced daily via AppleScript to a local JS data file, which is then auto-committed and pushed to GitHub. Anyone with access to the shared note can add meals.

## Architecture Overview

```
Apple Note "Meal Database"
        │
        ▼  (daily AppleScript + launchd)
  meals.js  ──► git commit + push
        │
        ▼
  GitHub Pages (index.html + app.js + style.css + meals.js)
```

## Meal Data Format (Apple Note)
One meal per line:
```
Meal Name - liam
Meal Name - chi
Meal Name - both
```
Meals with "chicken", "beef", or "salmon" in the name are auto-tagged as meat meals.

## Seed Data (from phyxphysio/meal_picker)

**Liam's meals:** Malaysian Satay Supreme, Chicken Salad Surprise, Lovely Quiche Lorraine, Beef Burger Bonanza, Thai Green Curry Galore

**Chi's meals:** Asian Noodle Salad, Buddha Bowls, Falafel Wraps, Poke Bowls, Mexican (Nut Mince/Jackfruit), Paneer Curry, Peanut Stew, Fritters, Moroccan Tagine, Vege Burgers, Pasta Verde, Soup, Kung Pao Tofu

## App Features
- **Generate week** button — assigns one meal per cooking day, no repeats
- **Cook-day config** — who cooks each day (default: Liam: Tue/Thu, Chi: Mon/Wed/Fri/Sun, Saturday: eat out)
- **Meat meal target** — configurable N, counts meals with chicken/beef/salmon in name; generation aims for exactly N
- **Regenerate per day** — swap that day's meal for another eligible one (respects no-repeat rule)
- **Copy week to clipboard** — formatted text of the full week

## Week Layout (defaults)
| Day | Cook |
|-----|------|
| Mon | Chi |
| Tue | Liam |
| Wed | Chi |
| Thu | Liam |
| Fri | Chi |
| Sat | Eat out (no meal) |
| Sun | Chi |

## Files to Create

| File | Purpose |
|------|---------|
| `index.html` | App shell, config UI, week display |
| `style.css` | Mobile-first minimal styles |
| `app.js` | Generation logic, regenerate, copy-to-clipboard |
| `meals.js` | Meal data — auto-updated by sync script (also the seed) |
| `sync_meals.applescript` | Reads Apple Note → writes meals.js → git commit/push |
| `com.mealprep.sync.plist` | launchd plist: runs AppleScript daily |
| `README.md` | Setup instructions (launchd install, note format) |

## Generation Algorithm
1. Split days into Liam-days and Chi-days (Saturday skipped)
2. Determine which meals are eligible per day based on cook assignment (`chi`, `liam`, or `both`)
3. Randomly assign meals satisfying the meat target:
   - If target = N meat meals: ensure exactly N days get a meat meal
   - Meat meals only come from Liam's days (all Chi meals are veggie), so target is capped at Liam's day count
4. Fill remaining days with non-meat meals, no repeats
5. If exact target is impossible (e.g. not enough meat meals), fall back to best-effort

## Design
- Mobile-first, minimal
- Clean day cards stacked vertically
- Config section collapsed/expandable at top
- Accent colour: warm neutral (no framework, plain CSS)

## Todos
1. Port meal data → `meals.js`
2. Build `index.html` + `style.css`
3. Build `app.js` (generate, regenerate, copy)
4. Write `sync_meals.applescript`
5. Write `com.mealprep.sync.plist` + `README.md`
6. Populate Apple Note "Meal Database" with seed data in correct format
