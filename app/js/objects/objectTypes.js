// objects/objectTypes.js — the built-in object library, as plain data. Adding a
// new catalog entry (a new machine, a new furniture piece, …) means adding an
// entry here, NOT touching editor.js. objectTypes carried on a layout (the
// `objectTypes` map in the schema) start as a copy of DEFAULT_OBJECT_TYPES and
// can be extended per-layout with user-defined custom types (see objectFactory.js).
//
// category is a free-form string grouping key used by ui/objectLibrary.js to
// render the side panel sections; CATEGORIES below defines the canonical
// order + display label for the built-in set, but a custom type may use any
// category string (it will render in its own "Other" style group).

export const CATEGORIES = [
  { id: 'machines', label: 'Machines' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'safety', label: 'Safety' },
  { id: 'other', label: 'Other' },
];

function type(id, name, category, width, depth, height, color, visual) {
  return { id, name, category, width, depth, height, color, visual: visual ?? icon(id) };
}

// Built-in types render as their top-down SVG icon by default; the icon's
// intrinsic width/height (set in each file) match width_m/depth_m so the
// default fit:'contain' covers the footprint edge-to-edge with no distortion.
function icon(id) {
  return { type: 'svg', source: `assets/icons/${id}.svg` };
}

export const DEFAULT_OBJECT_TYPES = {
  // ---- machines ----
  cnc: type('cnc', 'CNC', 'machines', 3.2, 2.2, 2.4, '#5279a8'),
  lathe: type('lathe', 'Lathe', 'machines', 2.8, 1.2, 1.6, '#4a7a9c'),
  mill: type('mill', 'Milling machine', 'machines', 2.0, 1.8, 2.0, '#52708a'),
  drill: type('drill', 'Drill press', 'machines', 0.8, 0.8, 2.1, '#6a7f94'),
  press: type('press', 'Press', 'machines', 1.8, 1.8, 2.6, '#3d6b8a'),
  saw: type('saw', 'Saw', 'machines', 1.6, 1.0, 1.4, '#567c91'),

  // ---- robotics ----
  robot: type('robot', 'Industrial robot', 'robotics', 1.0, 1.0, 2.0, '#c45252'),
  cobot: type('cobot', 'Cobot', 'robotics', 0.5, 0.5, 1.4, '#c47a52'),
  agv: type('agv', 'AGV', 'robotics', 0.8, 0.5, 0.4, '#c4a052'),

  // ---- furniture ----
  table: type('table', 'Table', 'furniture', 1.6, 0.8, 0.75, '#a87d52'),
  workbench: type('workbench', 'Workbench', 'furniture', 2.0, 0.8, 0.9, '#a87d52'),
  cabinet: type('cabinet', 'Cabinet', 'furniture', 1.0, 0.5, 2.0, '#6b5a45'),
  shelf: type('shelf', 'Shelving unit', 'furniture', 1.2, 0.4, 2.0, '#7a6a50'),

  // ---- infrastructure ----
  wall: type('wall', 'Wall', 'infrastructure', 3.0, 0.2, 2.5, '#555f68'),
  door: type('door', 'Door', 'infrastructure', 1.0, 0.2, 2.1, '#8a6a4a'),
  pillar: type('pillar', 'Pillar', 'infrastructure', 0.4, 0.4, 3.0, '#4a4a4a'),

  // ---- safety ----
  extinguisher: type('extinguisher', 'Fire extinguisher', 'safety', 0.3, 0.3, 0.6, '#c0392b'),
  emergency_exit: type('emergency_exit', 'Emergency exit', 'safety', 1.0, 0.2, 2.1, '#2ecc71'),
  fence: type('fence', 'Safety fence', 'safety', 2.0, 0.1, 1.1, '#d4a53d'),
  danger_zone: type('danger_zone', 'Danger zone marking', 'safety', 2.0, 2.0, 0.05, '#e67e22'),

  // ---- other ----
  pc: type('pc', 'PC', 'other', 0.5, 0.5, 0.4, '#3d4f5c'),
  display: type('display', 'Display / screen', 'other', 1.0, 0.1, 0.6, '#2c3e50'),
  electrical_panel: type('electrical_panel', 'Electrical panel', 'other', 0.8, 0.3, 2.0, '#34495e'),
};

// Deep-enough clone for seeding a layout's own objectTypes map (visual is the
// only nested object on a type).
export function cloneDefaultObjectTypes() {
  return Object.fromEntries(
    Object.entries(DEFAULT_OBJECT_TYPES).map(([k, t]) => [k, { ...t, visual: { ...t.visual } }]),
  );
}
