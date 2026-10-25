# Writing lessons

Lessons are JSON files. You don't need to touch any code.

1. Add the module to `modules.json` (id, icon, title, blurb, teacher note).
2. Create `lessons/<module id>.json` with the same id.
3. Run `npm run check-lessons` (in `frontend/`) and fix anything marked ✗.
4. Open http://localhost:3000/learn/<module id>?band=K-2 (try each band).

A module shows "Coming soon" on the map until its lesson file exists. A built module unlocks once every built module before it is finished ("Coming soon" ones don't block). For demos, open `/learn?demo=1`: all built modules stay open for that browser session.

## Grade bands and text

Bands: `"K-2"`, `"3-5"`, `"6-8"`, `"9-12"`. Any text can be one string for everyone, or one per band:

```json
"text": { "K-2": "A **data center** is a big building.", "9-12": "Data centers house racks of servers." }
```

- A missing band uses the nearest band's text (younger first). `check-lessons` warns about it.
- `**word**` shows the word bold in blue. Use it for key words.
- Placeholders: `{name}` (student's first name), `{guide}`, `{mw}`, `{mwh}`, `{homes}`, `{homeMWh}`, `{acres}`, `{fields}`, and any key in the lesson's `facts`. In a check step also `{choice}` (what they picked).
- Keep it short: about 130 characters for K-2, 240 for 9-12. The bubble gets crowded after that.
- Any step can have `"bands": ["6-8", "9-12"]` to show it only to those bands.
- Any step can have `"mood": "happy" | "thinking" | "wow"` for the guide's face.

## Numbers: only use facts you can source

- `{mw}`, `{mwh}` and `{homes}` are worked out from the data center's size (`{homes}` assumes full power all year; say so for 6-8 and 9-12).
- Every outside number goes in the lesson's `facts` with a `value` and a `source`, and is used in text as `{key}`. Add `"cite": ["key"]` to the step so the source shows under the text.
- Special facts: `homeMWhPerYear` (needed for `{homes}`) and `footballFieldAcres` (needed for `{fields}`). `{acres}` is the lot size of the preset (1 tile = 20 acres).
- Water (see module-3): with `evaporationKJPerKg` and `litersPerGallon` you get `{kWhPerGallon}` and `{gallonsPerDay}` (water *evaporated* if all its heat left by evaporating water; real sites can use more), plus `{bathtubs}` with `bathtubGallons` and `{people}` with `homeGallonsPerPersonDay`. The `"fact": "water"` card shows them.
- Numbers in the impacts panel come from our model, which isn't the real engine yet. Call them **rough estimates** in lesson text. A highlighted panel number also gets a "rough estimate" tag automatically.

## Lesson file

```json
{
  "id": "module-1",
  "title": "What is a data center?",
  "startYear": 2026,
  "facts": {
    "homeMWhPerYear": { "value": 10.791, "source": "U.S. EIA, 2022 average home" },
    "conversationDba": { "value": "60 to 70", "source": "CDC, What Noises Cause Hearing Loss?" }
  },
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
- `fact`: big number card: `"homes"`, `"water"`, `"mwh"` or `"mw"`.
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
- `{ "type": "do", "action": "abatement", "highlight": "money.per_student", ... }`: shows only the property tax break slider; any change counts as done.
- `{ "type": "do", "action": "cooling", "highlight": "water.daily", ... }`: shows only the cooling choice (air / hybrid / evaporative); any change counts as done.
- Any do step can `highlight` an impacts panel row.
- The year, abatement and cooling steps need a place step before them.

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
