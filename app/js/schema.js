// schema.js — the layout data contract.
//
// SCHEMA_VERSION is the version of the on-disk/in-storage layout format. Bump it
// whenever the shape of a layout changes, and add a migration in migrations.js
// that upgrades the previous version to the new one. validateLayout() is a
// lightweight structural check used by import and by the test suite; it is not a
// full JSON-Schema validator, just enough to catch obviously broken files.
//
// v7 adds a generic object model (objectTypes/objects) for the Workshop Layout
// Editor on top of the v6 warehouse model (racks/binTypes/bins/naming). The v6
// fields are NOT removed — old warehouse layouts keep their racks fully intact
// (see migrations.js 6->7) while new content is authored as generic objects.

export const SCHEMA_VERSION = 7;

export const VISUAL_TYPES = ['rectangle', 'image', 'svg', 'billboard', 'model3d'];
export const VISUAL_FITS = ['contain', 'cover'];

// Editor-native kinds (door/ramp/junction/dock/staging/charge) plus db_connect
// kinds (access_point/waypoint/staging_area/reference_marker) tolerated on
// import so a real db_connect file validates without translation (DEBT-005).
export const NODE_KINDS = [
  'door',
  'ramp',
  'junction',
  'dock',
  'staging',
  'charge',
  'access_point',
  'waypoint',
  'staging_area',
  'reference_marker',
];
export const RACK_DIRS = ['E', 'N'];

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Returns { ok: boolean, errors: string[] }.
export function validateLayout(layout) {
  const errors = [];
  const push = (m) => errors.push(m);

  if (layout == null || typeof layout !== 'object') {
    return { ok: false, errors: ['layout is not an object'] };
  }
  if (layout.schemaVersion !== SCHEMA_VERSION) {
    push(`schemaVersion must be ${SCHEMA_VERSION} (got ${layout.schemaVersion}); run a migration first`);
  }
  if (!layout.meta || typeof layout.meta.name !== 'string') {
    push('meta.name must be a string');
  }

  for (const key of ['zones', 'nodes', 'edges', 'racks']) {
    if (!Array.isArray(layout[key])) push(`${key} must be an array`);
  }
  if (!layout.binTypes || typeof layout.binTypes !== 'object') {
    push('binTypes must be an object');
  }

  // naming config
  const naming = layout.naming;
  if (!naming || typeof naming !== 'object' || Array.isArray(naming)) {
    push('naming must be an object');
  } else {
    if (typeof naming.separator !== 'string') push('naming.separator must be a string');
    if (!Number.isInteger(naming.bayPad) || naming.bayPad < 1)
      push('naming.bayPad must be a positive integer');
  }

  // binOverrides
  if (
    layout.binOverrides == null ||
    typeof layout.binOverrides !== 'object' ||
    Array.isArray(layout.binOverrides)
  ) {
    push('binOverrides must be an object');
  }

  (layout.zones || []).forEach((z, i) => {
    for (const k of ['x', 'y', 'w', 'd', 'elev', 'clearH']) {
      if (!isFiniteNumber(z[k])) push(`zones[${i}].${k} must be a number`);
    }
    if (typeof z.id !== 'string') push(`zones[${i}].id must be a string`);
  });

  const nodeIds = new Set();
  (layout.nodes || []).forEach((n, i) => {
    if (typeof n.id !== 'string') push(`nodes[${i}].id must be a string`);
    else nodeIds.add(n.id);
    if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) push(`nodes[${i}] needs numeric x,y`);
    if (n.kind && !NODE_KINDS.includes(n.kind)) push(`nodes[${i}].kind "${n.kind}" is not a known kind`);
  });

  (layout.edges || []).forEach((e, i) => {
    if (!nodeIds.has(e.a)) push(`edges[${i}].a "${e.a}" references a missing node`);
    if (!nodeIds.has(e.b)) push(`edges[${i}].b "${e.b}" references a missing node`);
  });

  const binTypeNames = Object.keys(layout.binTypes || {});
  (layout.racks || []).forEach((r, i) => {
    if (typeof r.id !== 'string') push(`racks[${i}].id must be a string`);
    if (!RACK_DIRS.includes(r.dir)) push(`racks[${i}].dir must be one of ${RACK_DIRS.join(', ')}`);
    if (!Number.isInteger(r.bays) || r.bays < 1) push(`racks[${i}].bays must be a positive integer`);
    if (!Number.isInteger(r.levels) || r.levels < 1) push(`racks[${i}].levels must be a positive integer`);
    if (!Array.isArray(r.levelHeights)) {
      push(`racks[${i}].levelHeights must be an array`);
    } else {
      if (r.levelHeights.length !== r.levels) {
        push(`racks[${i}].levelHeights.length (${r.levelHeights.length}) must equal levels (${r.levels})`);
      }
      if (!r.levelHeights.every((h) => isFiniteNumber(h) && h > 0)) {
        push(`racks[${i}].levelHeights must contain only positive numbers`);
      }
    }
    if (typeof r.rowToken !== 'string' || r.rowToken.length === 0)
      push(`racks[${i}].rowToken must be a non-empty string`);
    if (!Number.isInteger(r.bayStart) || r.bayStart < 1)
      push(`racks[${i}].bayStart must be a positive integer`);
    if (typeof r.bayReverse !== 'boolean') push(`racks[${i}].bayReverse must be a boolean`);
    if (!binTypeNames.includes(r.type)) push(`racks[${i}].type "${r.type}" is not a defined bin type`);
    const blo = r.bayLevelOverrides;
    if (blo != null) {
      if (typeof blo !== 'object' || Array.isArray(blo)) {
        push(`racks[${i}].bayLevelOverrides must be an object`);
      } else {
        Object.entries(blo).forEach(([bayKey, ov]) => {
          if (!ov || typeof ov !== 'object') {
            push(`racks[${i}].bayLevelOverrides[${bayKey}] must be an object`);
            return;
          }
          if (!Number.isInteger(ov.levels) || ov.levels < 1)
            push(`racks[${i}].bayLevelOverrides[${bayKey}].levels must be a positive integer`);
          if (!Array.isArray(ov.levelHeights)) {
            push(`racks[${i}].bayLevelOverrides[${bayKey}].levelHeights must be an array`);
          } else {
            if (ov.levelHeights.length !== ov.levels)
              push(`racks[${i}].bayLevelOverrides[${bayKey}].levelHeights.length must equal levels`);
            if (!ov.levelHeights.every((h) => isFiniteNumber(h) && h > 0))
              push(
                `racks[${i}].bayLevelOverrides[${bayKey}].levelHeights must contain only positive numbers`,
              );
          }
        });
      }
    }
  });

  // objectTypes — the generic object library (keyed by type id)
  const objectTypes = layout.objectTypes;
  if (objectTypes == null || typeof objectTypes !== 'object' || Array.isArray(objectTypes)) {
    push('objectTypes must be an object');
  } else {
    Object.entries(objectTypes).forEach(([key, t]) => {
      if (typeof t.id !== 'string' || t.id !== key)
        push(`objectTypes.${key}.id must be a string equal to its key`);
      if (typeof t.name !== 'string') push(`objectTypes.${key}.name must be a string`);
      if (typeof t.category !== 'string') push(`objectTypes.${key}.category must be a string`);
      for (const k of ['width', 'depth', 'height']) {
        if (!isFiniteNumber(t[k]) || t[k] <= 0) push(`objectTypes.${key}.${k} must be a positive number`);
      }
      if (t.visual) validateVisual(t.visual, `objectTypes.${key}.visual`, push);
    });
  }

  // objects — generic object instances placed in the layout
  if (!Array.isArray(layout.objects)) {
    push('objects must be an array');
  } else {
    const typeNames = new Set(Object.keys(objectTypes || {}));
    const objectIds = new Set();
    layout.objects.forEach((o, i) => {
      if (typeof o.id !== 'string' || o.id.length === 0) push(`objects[${i}].id must be a non-empty string`);
      else if (objectIds.has(o.id)) push(`objects[${i}].id "${o.id}" is not unique`);
      else objectIds.add(o.id);
      if (typeof o.type !== 'string' || !typeNames.has(o.type))
        push(`objects[${i}].type "${o.type}" is not a defined objectType`);
      if (!isFiniteNumber(o.x) || !isFiniteNumber(o.y)) push(`objects[${i}] needs numeric x,y (centre point)`);
      if (o.rotation != null && !isFiniteNumber(o.rotation)) push(`objects[${i}].rotation must be a number`);
      for (const k of ['width', 'depth', 'height']) {
        if (o[k] != null && (!isFiniteNumber(o[k]) || o[k] <= 0))
          push(`objects[${i}].${k} must be a positive number when set`);
      }
      if (o.visual) validateVisual(o.visual, `objects[${i}].visual`, push);
      if (o.dataBinding != null && typeof o.dataBinding !== 'object')
        push(`objects[${i}].dataBinding must be an object`);
      if (o.properties != null && typeof o.properties !== 'object')
        push(`objects[${i}].properties must be an object`);
    });
  }

  if (layout.assets == null || typeof layout.assets !== 'object' || Array.isArray(layout.assets)) {
    push('assets must be an object');
  }

  return { ok: errors.length === 0, errors };
}

function validateVisual(visual, path, push) {
  if (typeof visual !== 'object' || Array.isArray(visual)) {
    push(`${path} must be an object`);
    return;
  }
  if (!VISUAL_TYPES.includes(visual.type)) {
    push(`${path}.type must be one of ${VISUAL_TYPES.join(', ')}`);
  }
  if (visual.fit != null && !VISUAL_FITS.includes(visual.fit)) {
    push(`${path}.fit must be one of ${VISUAL_FITS.join(', ')}`);
  }
  if (visual.source != null && typeof visual.source !== 'string') {
    push(`${path}.source must be a string`);
  }
}
