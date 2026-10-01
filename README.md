# Workshop Layout Editor

A browser-based editor for industrial workshop floor layouts — zones, machines,
robots, furniture, infrastructure and safety objects, path nodes/edges, and a
calibrated background tracing image — with a live 2D plan and a 3D preview.
Layouts export to JSON and can be stored in Postgres.

The project started life as a warehouse rack-layout editor. It is being
migrated **progressively** to a generic workshop/industrial layout tool that
can later serve as the visual base layer for a SCADA system: every placed
object carries an optional `dataBinding.entityId` so a future SCADA front-end
can bind it to a live tag/entity, but no SCADA protocol (MQTT, OPC UA,
WebSocket, ThingsBoard, ...) is implemented here — only the data shape that
supports wiring one in later. The original warehouse model (zones, rack rows,
bin types, bins) still works exactly as before and is not being deleted; it
now sits alongside the new generic object model rather than being replaced by
it. See [Two data models, side by side](#two-data-models-side-by-side) below.

The app is a static client (HTML/CSS/ES modules + a vendored copy of three.js).
Python is used for a tiny dev server and the optional database layer.

---

## Quick start (run it with Python)

You need **Python 3.10+**. No build step, no `npm install` required to run.

```bash
# from the repository root
python -m server.dev_server
```

Open the printed URL — **http://localhost:8000**. That's it.

> The server always serves the `app/` folder, so you can launch it from the repo
> root and the app finds its data correctly. The app must be served over HTTP
> (it uses ES modules and `fetch`); opening `app/index.html` as a `file://` page
> will show an error instead of the editor.

If you'd rather use any other static server, point it at the `app/` directory:

```bash
cd app
python -m http.server 8000      # then open http://localhost:8000
```

### Using the editor

- **Toolbar:** Select/Move, +Zone, +Rack Row, +Node/Door, +Path Edge, Delete.
- **Keyboard:** `V` select · `Z` zone · `R` rack · `N` node · `E` edge ·
  `X` delete · `M` toggle Edit/View mode · `L` labels · `Esc` cancel ·
  `Del` remove selected. All shortcuts except `V`, `L` and `M` are disabled in
  View mode (see below).
- **Canvas:** drag to move a selected object, right-drag to pan, scroll to zoom.
- **2D Plan / 3D Preview** toggle in the toolbar.
- **Export JSON / Import JSON** for sharing or version-controlling a layout.

Your edits autosave to the browser's `localStorage`, so a reload keeps your work.
To reset back to the shipped default, run this in the browser console (F12) and
reload:

```js
localStorage.removeItem('warehouse_layout_editor_v1');
```

### Placing and editing generic objects

The **Object library** panel (left side, under Properties) lists every
`objectType` in the current layout, grouped by category (Machines, Robotics,
Furniture, Infrastructure, Safety, Other). Click a type, then click the plan
to place an instance — the tool stays armed, so you can place several in a
row, just like Zone/Rack/Node.

Click a placed object to select it and open its properties panel:

- **ID / Name** — free text.
- **x / y (m)** — the object's **centre** point (note: zones and rack rows use
  their SW-corner for `x, y`; generic objects use their centre — see
  [Coordinate system](#coordinate-system)).
- **Rotation (deg)** — any angle, not just 0/90/180/270 (e.g. `137.5`); the
  `⟲ 45° / ⟳ 45°` buttons nudge it. Rotation is drawn correctly in both the 2D
  plan and the 3D preview, and clicking/selecting an object is rotation-aware
  (hit-testing checks the rotated footprint, not just its bounding box).
- **Width / Depth / Height (m)** and **Color** — each shows the *effective*
  value (its own override, or the value inherited from the object's type) with
  a **↺ reset** button that clears the instance override and falls back to the
  type's default again.
- **Visual** — `rectangle` (default, flat-colour box), `image`, `svg`,
  `billboard` (always faces the camera in 3D), or `model3d` (a `.glb`/`.gltf`
  asset). Choosing anything but `rectangle` reveals a **Source** field
  (`asset://<id>` or an external URL), a **Fit** choice (`contain`/`cover`),
  and an **Upload image…** button for PNG/JPG/JPEG/WEBP/SVG files, stored
  entirely client-side (see [Image/asset storage](#imageasset-storage)). If a
  source is missing or fails to load, the renderer falls back to a plain
  rectangle in 2D and a box in 3D rather than breaking.
- **Data binding** — an `entityId` string. Unused by the editor itself; this is
  the field a future SCADA integration would read.
- **Custom properties (JSON)** — a free-form key/value bag for anything else
  you want to carry on the object.
- **Duplicate / Delete object** buttons.

You can also define your **own object types** from the "+ Custom object type"
form at the bottom of the Object library panel (name, category,
width/depth/height, color) — no code changes needed; it's added to the
layout's own `objectTypes` map.

### Edit Mode vs. View Mode (read-only / SCADA preview)

The **Edit Mode / View Mode** button in the toolbar (or the `M` key) toggles
the whole editor into a read-only inspection mode:

- Every editing control (tools, Object library, Bin types, Background,
  Settings) becomes visually dimmed and inert.
- The properties panel shows a read-only info card instead of editable fields.
- Clicking a placed object still works, but only to *inspect* it, and it fires
  a `workshop:object-click` event on `window`:

  ```js
  window.addEventListener('workshop:object-click', (e) => {
    const { id, type, entityId } = e.detail;
    // a future SCADA front-end would use entityId to look up a live value
  });
  ```

  This is the integration point a future SCADA overlay is expected to bind to;
  no actual SCADA protocol is implemented behind it yet.

---

## Coordinate system

- **Origin (0, 0)** is the SW (south-west) corner of Zone E.
- **+x = East**, **+y = North**, **+z = Up** (elevation), all in **metres**.
- The 2D plan shows the origin with red (East) and green (North) axis arrows and
  a fixed **N** compass in the top-right corner (north is always screen-up in 2D).
- The 3D preview shows an origin marker at (0, 0, 0) with labeled **+X East**,
  **+Y North**, **+Z Up** axes.
- **Zones and rack rows** are anchored at their **SW corner** (`x, y` + `w, d`).
  **Generic objects** (the new model) are anchored at their **centre** (`x, y`
  + `width, depth`), which is what makes arbitrary rotation straightforward —
  rotating a rectangle about its own centre needs no corner recomputation.
  Keep this distinction in mind when reading/writing layout JSON by hand.
- Rotation is counter-clockwise, in degrees, matching standard math convention
  and three.js's `rotation.y`. The 2D canvas renderer negates it internally
  (`ctx.rotate(-θ)`) purely because screen-space Y is flipped relative to
  world-space Y; this is an implementation detail of
  `objects/objectRenderer2d.js`, not a change to the angle's meaning.

---

## Two data models, side by side

This is a **progressive migration**, not a rewrite: the original
warehouse-specific model and the new generic model both live in the same
layout file and are both fully functional.

**Legacy warehouse model** (unchanged): `zones`, `nodes`, `edges`, `racks`,
`binTypes`, `naming`, `binOverrides`. Racks expand into individual bins
(`ROW-BAY-LEVEL` labels) for the WMS export. Still the right tool for racking.

**Generic object model** (new, this project's focus going forward):

- **`objectTypes`** — the catalog: a map of `type id -> { id, name, category,
  width, depth, height, color, visual }`. Seeded from the built-in library in
  `app/js/objects/objectTypes.js` (CNC, lathe, mill, drill, press, saw, robot,
  cobot, AGV, table, workbench, cabinet, shelf, wall, door, pillar,
  extinguisher, emergency exit, fence, danger-zone marking, PC, display,
  electrical panel) and extensible per-layout with user-defined custom types.
- **`objects`** — placed instances: `{ id, name, type, x, y, rotation,
  width?, depth?, height?, color?, visual?, dataBinding: { entityId },
  properties }`. Any of `width/depth/height/color/visual/name/category` may be
  omitted on an instance, in which case it's inherited from the instance's
  `objectType` (see `resolveObject()` in `app/js/objects/objectFactory.js`,
  the single place that implements that fallback chain).
- **`assets`** — a manifest pass-through in the layout JSON; actual binary
  asset bytes never go in layout JSON (see next section).

Racks are **not** auto-converted into generic objects by the schema migration
— that would be a lossy, surprising rewrite of real warehouse data on load.
If you want a rack area represented as a generic object too, add one by hand
(or build a one-off conversion script later; none exists today).

---

## Image/asset storage

Uploaded images (PNG/JPG/JPEG/WEBP/SVG) are stored **client-side only**, in the
browser's IndexedDB (`app/js/assets/assetStore.js`), never inlined into the
layout JSON and never uploaded anywhere. An object's `visual.source` then
references the asset as `asset://<id>`. This keeps exported layout files small
and portable; if a layout is imported into a different browser/profile and the
referenced asset isn't there, the renderer falls back to a plain rectangle (2D)
or box (3D) rather than failing.

`.glb`/`.gltf` 3D models are intended to use the same `asset://` scheme with
`visual.type: 'model3d'`; the 3D preview loads them via a vendored
`GLTFLoader` and falls back to a box on load failure. GLB upload UI is not
wired up yet (today you'd set `visual.source` to an external URL by hand for
`model3d` previews); image upload (2D-facing `image`/`svg`/`billboard` visuals)
is fully wired from the properties panel's **Upload image…** button.

---

## Updating the data

There are two kinds of "data," and they're separate on purpose:

1. **The shipped default layout** — `app/data/default_layout.json`. This is what
   a brand-new browser (with no saved draft) loads. It's a ~20m×15m example
   workshop (machining zone "MECANIZADO", an aisle "PASILLO-TALLER", and an
   assembly zone "MONTAJE") with two CNC machines, one lathe, two tables, one
   industrial robot and one cabinet, placed at a mix of rotations (0°, 45°,
   90°, 137.5°) to demonstrate the generic object model — alongside the
   original warehouse racks, which are untouched. Edit this file to change the
   starting layout for everyone; it's plain JSON, reload the page to see
   changes. After editing, the test suite will tell you if you broke the
   structure (`pytest tests/test_layout_schema.py`).

2. **A working layout you're editing** — lives in the browser and in exported
   JSON files. Use **Export JSON** to save one to disk and **Import JSON** to
   load it back.

### Save format (db_connect-native)

Exported files use the **db_connect shape**, which feeds directly into the WMS
pipeline. Top-level keys: `meta` (with `coordinate_system` and
`bin_label_format`), `settings`, `categories`, `binTypes`, `vehicles`,
`dwell_times`, `zones`, `nodes`, `edges`, `racks`, `bins`, `objectTypes`,
`objects`, `assets`, and an `editor` extension block (`schemaVersion`,
`naming`, `binOverrides`).

`bins` are **generated on every save** — not stored on rack objects. Each bin
carries a `whse_location`: the 3-part HomeSource join key `ROW-BAY-LEVEL`
(e.g. `C-01-1`). Zone is a separate field on the bin record and does not appear
in the label string. (db_connect's sample uses a 4-part zone-prefixed form;
the 3-part form matches the WMS join-key format.)

See **[docs/step4-mapping.md](docs/step4-mapping.md)** for the full field-by-field
mapping between the editor's internal model and the db_connect file format.

### Schema versioning

Layout files carry a version in `editor.schemaVersion`. The current version is
**7**, which adds `objectTypes`/`objects`/`assets` on top of the v6 warehouse
shape — purely additively; every v6 field is kept byte-for-byte intact, and a
v6 layout migrates forward automatically with an empty `objects: []` (see
`6 -> 7` in `app/js/migrations.js`). When the format changes again, bump
`SCHEMA_VERSION` in `app/js/schema.js` and add a migration in
`app/js/migrations.js`. Old drafts and imported files are migrated
automatically on load; migrations never delete user data. The translator pair
(`toDbConnect` / `fromDbConnect` in `app/js/dbconnect.js`) handles conversion
between the editor's internal state and the on-disk format.

---

## Storing layouts in Postgres (optional)

The editor works without a database. If you want central storage, see
**[docs/postgres.md](docs/postgres.md)** — it covers installing the driver,
setting `DATABASE_URL`, creating the schema, seeding the default, and reading /
writing layouts from Python. In short:

```bash
pip install -r requirements.txt
export DATABASE_URL="postgresql://user:password@localhost:5432/warehouse"
python -m server.seed
```

---

## Project structure

```
workshop-layout-editor/
├── app/                      # the static client (this is the web root)
│   ├── index.html
│   ├── css/styles.css
│   ├── data/default_layout.json   # shipped default layout (edit this)
│   ├── js/
│   │   ├── main.js           # entry point: load layout, start editor
│   │   ├── editor.js         # 2D plan editor (tools, drawing, panels, I/O)
│   │   ├── preview3d.js      # 3D preview (three.js)
│   │   ├── store.js          # localStorage draft + default fetch
│   │   ├── migrations.js     # schema migrations
│   │   ├── schema.js         # schema version + validator
│   │   ├── geometry.js       # pure layout math + bin expansion + rotation math
│   │   ├── dbconnect.js      # toDbConnect / fromDbConnect (db_connect format)
│   │   ├── objects/
│   │   │   ├── objectTypes.js      # built-in object catalog (data only)
│   │   │   ├── objectFactory.js    # create/resolve/duplicate/clone instances
│   │   │   ├── objectHitTest.js    # rotation-aware hit-testing
│   │   │   └── objectRenderer2d.js # 2D canvas rendering of generic objects
│   │   ├── assets/
│   │   │   ├── assetStore.js       # IndexedDB binary asset storage
│   │   │   └── imageLoader.js      # image upload + cached-image rendering
│   │   └── ui/
│   │       └── objectLibrary.js    # categorized object-library side panel
│   └── vendor/three.module.js, GLTFLoader.js
├── server/                   # Python: dev server + Postgres layer
│   ├── dev_server.py         # python -m server.dev_server
│   ├── persistence.py        # LayoutRepository (psycopg)
│   ├── layout_schema.py      # Python mirror of the JS validator
│   ├── config.py             # DATABASE_URL
│   └── seed.py               # python -m server.seed
├── schema/0001_init.sql      # Postgres DDL
├── tests/                    # pytest + node --test
├── docs/postgres.md
├── VERSION, CHANGELOG.md, LICENSE, .gitignore
└── pyproject.toml, package.json, eslint.config.js, .prettierrc.json
```

---

## Development

```bash
# Python: lint, format check, tests
pip install -r requirements-dev.txt
ruff check .
ruff format --check .
pytest

# JavaScript: unit tests (no install needed), plus optional lint/format
node --test tests/js/
npm install        # only needed for eslint/prettier
npm run lint
npm run format
```

CI runs all of the above on every push and pull request
(`.github/workflows/ci.yml`).

The JS unit tests cover the pure modules (`geometry.js`, `migrations.js`,
`schema.js`, `objects/objectFactory.js`, `objects/objectHitTest.js`); the
editor UI, image upload, and 3D rendering are exercised by hand in the
browser. **This repository's automated environment has no browser-automation
tool**, so interactive click-through testing (placing/selecting/rotating/
resizing/duplicating an object, uploading an image, toggling Edit/View mode)
has not been performed by an agent here — only `node --test`, `eslint`,
`pytest`, and HTTP-serving smoke checks. Please click through those flows by
hand after pulling changes that touch `editor.js`, `preview3d.js`, or anything
under `objects/`, `assets/`, or `ui/`.

### How to test each new feature manually

1. Run `python -m server.dev_server` and open the printed URL.
2. **Object library / placement** — click a category item in "Object library",
   then click the plan; repeat for a few types; confirm each appears at the
   right size/color.
3. **Rotation** — select a placed object, set Rotation to a non-right angle
   (e.g. `30`), confirm the 2D shape rotates about its centre and that
   clicking near a rotated corner still selects it (not just its bounding box).
4. **Dimension/color inheritance** — select an object, confirm Width/Depth/
   Height/Color show the type's defaults with the **↺** button disabled; edit
   one, confirm the button enables; click it, confirm it reverts.
5. **Custom object type** — open "+ Custom object type", fill it in, click
   "Add type"; confirm it appears in the library and can be placed.
6. **Image upload** — select an object, set Visual to `image`, click "Upload
   image…", pick a PNG/JPG; confirm it renders in place of the flat rectangle,
   in both 2D and 3D Preview.
7. **Edit/View mode** — click "Edit Mode" (or press `M`); confirm the side
   panel dims and the properties panel becomes read-only; click an object and
   confirm it still highlights/inspects; open the browser console and run
   `window.addEventListener('workshop:object-click', e => console.log(e.detail))`
   before clicking an object to see the event fire.
8. **Export/Import** — Export JSON, inspect that `objectTypes`/`objects`
   appear in the file, re-import it, confirm nothing is lost.
9. **Legacy regression** — confirm Zone/Rack Row/Node/Edge tools, bin types,
   and the background tracing image calibration still work exactly as before.

---

## Vendoring three.js

The 3D preview requires `app/vendor/three.module.js` (three.js r128 ES module)
and `app/vendor/GLTFLoader.js` (for `visual.type: 'model3d'` objects). Neither
is included in the repository — vendor them once:

```bash
cd /tmp && npm pack three@0.128.0 && tar xzf three-0.128.0.tgz
cp package/build/three.module.js <repo>/app/vendor/three.module.js
cp package/examples/jsm/loaders/GLTFLoader.js <repo>/app/vendor/GLTFLoader.js
```

The 2D editor works without them; only clicking "3D Preview" (or placing a
`model3d` object) requires the files.

---

## Pending / future work

- **Actual SCADA wiring** (MQTT/OPC UA/WebSocket/ThingsBoard) behind the
  `workshop:object-click` event and `dataBinding.entityId` — intentionally not
  implemented yet; only the data shape and the click hook exist today.
- **Graphical rotate/resize handles** directly on the 2D canvas, as an
  alternative to typing values into the properties panel (the spec treats the
  properties panel as sufficient; canvas handles were optional).
- **GLB/GLTF upload UI** — `model3d` visuals can be pointed at an external URL
  today; a dedicated "Upload model…" button mirroring the image-upload flow,
  storing the `.glb` in `assetStore.js`, is not wired up yet.
- **A key/value UI for `properties`** instead of the raw-JSON textarea.
- **Asset garbage-collection** — IndexedDB assets are never deleted when the
  object/visual referencing them is deleted or changed; nothing accumulates in
  the layout JSON itself, but orphaned blobs can accrue in a browser's
  IndexedDB over time.
- **A one-off script to promote existing racks into generic objects**, for
  anyone who wants to represent racking visually in the new model instead of
  (or alongside) the warehouse-specific rendering — not built, since it wasn't
  required and the two models already coexist without it.

---

## Versioning

The project uses [Semantic Versioning](https://semver.org/); the current release
is in [`VERSION`](VERSION) and changes are recorded in
[`CHANGELOG.md`](CHANGELOG.md). Note this is distinct from the layout
`schemaVersion`, which versions the data format rather than the app.

## Committing to GitHub

See **[docs/git-and-github.md](docs/git-and-github.md)** for first-commit, remote
setup, and push instructions. In short, from the repo root:

```bash
git init && git add . && git commit -m "Initial commit: workshop layout editor"
git tag -a v0.1.0 -m "v0.1.0"
# then create a remote and: git push -u origin main && git push --tags
```

## License

MIT — see [`LICENSE`](LICENSE).
