# Writing lessons

Lessons are JSON files. You don't need to touch any code.

1. Add the module to `modules.json` (id, icon, title, blurb, teacher note).
2. Create `lessons/<module id>.json` with the same id.
3. Run `npm run check-lessons` (in `frontend/`) and fix anything marked ✗.
4. Open http://localhost:3000/learn/<module id>?band=K-2 (try each band).

A module shows "Coming soon" on the map until its lesson file exists. Each module unlocks when the one before it is finished.

## Grade bands and text

Bands: `"K-2"`, `"3-5"`, `"6-8"`, `"9-12"`. Any text can be one string for everyone, or one per band:

```json
"text": { "K-2": "A **data center** is a big building.", "9-12": "Data centers house racks of servers." }
```

- A missing band uses the nearest band's text (younger first). `check-lessons` warns about it.
- `**word**` shows the word bold in blue. Use it for key words.
- Placeholders: `{name}` (student's first name), `{guide}`, `{mw}`, `{mwh}`, `{homes}`, `{homeMWh}`. In a check step also `{choice}` (what they picked).
- Keep it short: about 130 characters for K-2, 240 for 9-12. The bubble gets crowded after that.
- Any step can have `"bands": ["6-8", "9-12"]` to show it only to those bands.
- Any step can have `"mood": "happy" | "thinking" | "wow"` for the guide's face.

## Numbers: only use facts you can source

- `{mw}`, `{mwh}` and `{homes}` are worked out from the data center's size (`{homes}` assumes full power all year; say so for 6-8 and 9-12).
- The electricity a home uses comes from the lesson's `facts.homeMWhPerYear` (`value` in MWh per year plus a `source`). The source is shown to students.
- Numbers in the impacts panel come from our model, which isn't the real engine yet. Call them **rough estimates** in lesson text.

## Lesson file

```json
{
  "id": "module-1",
  "title": "What is a data center?",
  "startYear": 2026,
  "facts": { "homeMWhPerYear": { "value": 10.791, "source": "U.S. EIA, 2022 average home" } },
  "steps": [ ... ]
}
```

Optional: `"showImpacts": ["6-8", "9-12"]`: bands that see the numbers panel once something is placed (this is the default).

## Steps

The lesson always takes place in Wilmington, Ohio.

**talk**: the guide says something. Optional `fly` (camera) and `landmark` (pin to highlight).
```json
{ "type": "talk", "text": "Hi {name}!", "fly": "home" }
```

**look**: fly the camera to something and point at it.
```json
{ "type": "look", "target": "water_tower", "highlight": "water.daily", "fact": "homes", "text": "..." }
```
- `target`: `"home"`, `"datacenter"`, `"loudzone"`, a landmark (`"school"`, `"college"`, `"hospital"`, `"fire"`, `"police"`, `"cityhall"`, `"water"`, `"water_tower"`, `"substation"`; the nearest one is used), or `{ "x": 500, "z": -300 }` in meters (x east, z south of the town center).
- `highlight`: an impacts panel row (list in `app/metricKeys.ts`, e.g. `"power.homes"`, `"water.daily"`, `"noise.loud_zone"`).
- `fact`: big number card: `"homes"`, `"mwh"` or `"mw"`.
- `lockCamera`: `true` stops the student moving the camera.

**predict**: multiple choice guess. `id` must be unique in the lesson.
```json
{ "type": "predict", "id": "homes", "text": "...", "choices": [ { "id": "a", "text": "About 50 homes" }, { "id": "b", "text": "..." } ] }
```

**do**: the student does something; Next unlocks when done.
```json
{ "type": "do", "action": "place", "preset": "enterprise", "suggest": { "x": -1200, "z": 2800 }, "text": "...", "doneText": "Nice!" }
{ "type": "do", "action": "year", "atLeast": 2027, "text": "Drag the year slider to 2027." }
```
- `preset`: `"enterprise"` (60 MW), `"hyperscale"` (250 MW) or `"ai"` (1,000 MW).
- `suggest`: a glowing "Build here!" spot (moved to the nearest buildable lot). Shown to K-2 and 3-5 unless you add `"bands"` inside it.
- The year step needs a place step before it.

**check**: compare a prediction to the answer.
```json
{ "type": "check", "prediction": "homes", "answer": "c", "fact": "homes", "text": { "right": "...", "wrong": "You picked {choice}. ..." } }
```

**reflect**: a vote or a short written answer, shown on the printable "My work" page.
```json
{ "type": "reflect", "id": "want", "kind": "vote", "text": "...", "choices": [ ... ] }
{ "type": "reflect", "id": "tradeoff", "kind": "short", "text": "...", "placeholder": "One good thing is…" }
```
Short answers need at least 3 characters before Next works.

## Guides

`guides.json` holds each guide's name, color and tagline, so they can be renamed freely. The drawings are in `app/learn/Guide.tsx` (ids `volt`, `drip`, `bit`, `fern`).
