# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-10-02

### Added

- **Generic object model** (schema v6→v7): a workshop/industrial layout model
  — `objectTypes` (a catalog of machines, robots, furniture, infrastructure,
  safety and other equipment) and `objects` (placed instances) — alongside the
  existing warehouse model, which is kept fully intact. Instances support
  **arbitrary rotation** (not just 0/90/180/270), and may override their
  type's width/depth/height/color/visual, inheriting whatever they don't
  override (`resolveObject()` in `app/js/objects/objectFactory.js`).
- **Object library side panel** (`app/js/ui/objectLibrary.js`): categorized,
  data-driven list of placeable object types, plus an in-panel form for
  defining custom object types without touching code.
- **Generic object editing**: place/select/move/duplicate/rotate/delete via the
  properties panel, with rotation-aware hit-testing
  (`app/js/objects/objectHitTest.js`) and rendering
  (`app/js/objects/objectRenderer2d.js`) in the 2D plan.
- **Visual types** `rectangle` / `image` / `svg` / `billboard` / `model3d`,
  with graceful fallback to a flat rectangle (2D) or box (3D) when a source is
  missing or fails to load. 3D rendering extended in `app/js/preview3d.js`
  (billboard sprites, `GLTFLoader`-based `.glb`/`.gltf` models).
- **Client-side image upload** (PNG/JPG/JPEG/WEBP/SVG), stored in IndexedDB
  (`app/js/assets/assetStore.js`, `app/js/assets/imageLoader.js`) and
  referenced from layout JSON via an `asset://<id>` URI — binary data never
  touches the portable layout file.
- **Edit Mode / View Mode (SCADA preview) toggle**: View mode makes every
  editing control inert and read-only, and dispatches a `workshop:object-click`
  window event (`{ id, type, entityId }`) when a placed object is clicked —
  the intended integration point for a future SCADA front-end. No SCADA
  protocol is implemented.
- **`dataBinding.entityId`** on every object instance, for that same future
  binding to an external entity/tag.
- New example default layout: a ~20m×15m workshop (machining zone, aisle,
  assembly zone) with two CNC machines, a lathe, two tables, an industrial
  robot and a cabinet at varied rotations, alongside the original warehouse
  racks.
- App renamed in the UI to **Workshop Layout Editor** (topbar/title only —
  warehouse-specific labels like "+ Rack Row" and "Bin types" are left as-is
  since that feature is unchanged legacy functionality).

### Schema

- `schemaVersion` is now `7`. Migration `6→7` is purely additive: it seeds
  `objectTypes` (from the built-in catalog), `objects: []`, and `assets: {}`
  on any v6 layout without touching racks/binTypes/bins/naming. Existing racks
  are **not** auto-converted into generic objects.

## [0.2.0] — 2026-06-23

### Added

- **db_connect-native save format** (schema v4→v5): layouts are now saved and
  loaded in the db_connect shape — top-level `meta` (with `coordinate_system` and
  `bin_label_format`), `settings`, `categories`, `binTypes`, `vehicles`,
  `dwell_times`, `zones`, `nodes`, `edges`, `racks`, generated `bins`, and an
  `editor` extension block (`naming`, `binOverrides`, `schemaVersion`). Feed
  directly into the WMS db_connect pipeline.
- **Generated `whse_location` bins**: on every save, bins are expanded from rack
  definitions and written to the file. Each bin carries a `whse_location` — the
  3-part HomeSource join key `ROW-BAY-LEVEL` (e.g. `C-01-1`). Zone is a separate
  field on the bin record and does not appear in the label string.
- **Lossless pass-through**: `categories`, `vehicles`, `dwell_times`,
  `zone.operations`, edge traffic attributes, and rack `access_face` /
  `back_to_back_spine` are preserved unchanged across load/save cycles.
- **Coordinate system declaration** (`meta.coordinate_system`): origin at the
  receiving station, +X East, +Y North, +Z Up, signed positions, no coordinate
  shift. Set by site survey (DEBT-010).
- **`app/js/dbconnect.js`**: `toDbConnect()` / `fromDbConnect()` translator pair.
- **Three-layer bin naming** (schema v3→v4): `pattern` (separator + bay-pad) +
  per-rack `rowToken` / `bayStart` / `bayReverse` overrides + per-bin
  `binOverrides`. Labels take the form `ROW-BAY-LEVEL` (e.g. `C-01-1`).
- **Per-level rack heights** (schema v2→v3): each rack stores an explicit
  `levelHeights` array; bin z-coordinates use cumulative heights.

### Fixed

- Mac 3D preview: touch-action pan/zoom conflict resolved (pointer-events
  suppressed on the canvas overlay).

### Schema

- `schemaVersion` is now `5` (in `editor.schemaVersion` in the file format).
  Migrations `2→3`, `3→4`, `4→5` are forward-only and run automatically on load.

## [0.1.0] — 2026-06-12

### Added

- 2D plan editor: zones, rack rows, path nodes, and path edges with select/move,
  add, and delete tools; snap and grid settings; background tracing image with
  two-point scale calibration.
- 3D preview of the current layout, including an origin marker, labeled X/Y/Z
  axes, and a north arrow.
- Origin axes and a fixed north compass in the 2D plan.
- JSON import/export; export enriches the layout with zone containment, edge
  distances, and expanded per-bin records.
- Layout **schema versioning** (`schemaVersion`) with forward-only migrations.
- Decoupled seed data: the default layout lives in `app/data/default_layout.json`.
- Python dev server that serves the `app/` web root with correct MIME types.
- Postgres persistence layer (schema + `LayoutRepository`) and a seed command.
- Test suite (pytest + `node --test`), linting/formatting (ruff, eslint,
  prettier), and GitHub Actions CI.

### Schema

- `schemaVersion` is now `2`. Migration `1 -> 2` lifts the format version out of
  `meta.version` into a top-level `schemaVersion`.
