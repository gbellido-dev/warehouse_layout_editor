// objects/objectFactory.js — creating, resolving and cloning generic object
// instances. Pure functions (no DOM) so they're unit-testable like geometry.js.
//
// An object instance may omit width/depth/height/color/visual/name/category —
// those fall back to its objectType. resolveObject() is the single place that
// implements the fallback chain (instance -> type -> hard default) so the
// renderer, hit-tester and properties panel never duplicate that logic.

const HARD_DEFAULT = {
  width: 1,
  depth: 1,
  height: 1,
  color: '#7a8a9a',
  name: 'Object',
  category: 'other',
  visual: { type: 'rectangle' },
};

// Resolve the effective (width, depth, height, color, visual, name, category)
// for a placed object, applying: instance field -> objectType field -> hard
// default. Does not mutate `obj`.
export function resolveObject(obj, objectTypes) {
  const t = (objectTypes && objectTypes[obj.type]) || null;
  const visual = obj.visual ?? t?.visual ?? HARD_DEFAULT.visual;
  return {
    width: obj.width ?? t?.width ?? HARD_DEFAULT.width,
    depth: obj.depth ?? t?.depth ?? HARD_DEFAULT.depth,
    height: obj.height ?? t?.height ?? HARD_DEFAULT.height,
    color: obj.color ?? t?.color ?? HARD_DEFAULT.color,
    name: obj.name ?? t?.name ?? HARD_DEFAULT.name,
    category: obj.category ?? t?.category ?? HARD_DEFAULT.category,
    visual: { fit: 'contain', ...visual },
  };
}

// Generate an id like "CNC-01" that isn't already used by an existing object.
export function nextObjectId(typeKey, objects) {
  const prefix = (typeKey || 'OBJ').toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  for (let i = 1; i < 1000; i++) {
    const id = `${prefix}-${String(i).padStart(2, '0')}`;
    if (!objects.some((o) => o.id === id)) return id;
  }
  return `${prefix}-${Date.now()}`;
}

// Create a new object instance of `typeKey` centred at (x, y). rotation
// defaults to 0; width/depth/height/color/visual are left undefined so they
// inherit from the objectType (see resolveObject) until the user overrides them.
export function createObjectInstance(typeKey, x, y, objectTypes, objects) {
  const t = objectTypes[typeKey];
  return {
    id: nextObjectId(typeKey, objects),
    name: t ? t.name : 'Object',
    type: typeKey,
    x,
    y,
    rotation: 0,
    dataBinding: { entityId: null },
    properties: {},
  };
}

// Clone an object with a new id, offset slightly so it doesn't sit exactly on
// top of the original.
export function duplicateObjectInstance(obj, objects) {
  const clone = JSON.parse(JSON.stringify(obj));
  clone.id = nextObjectId(obj.type, objects);
  clone.name = obj.name ? `${obj.name} copy` : clone.name;
  clone.x = obj.x + 0.5;
  clone.y = obj.y - 0.5;
  return clone;
}

let customTypeSeq = 1;

// Create a new entry for layout.objectTypes from the "custom object" form
// (section 6 of the spec): name, category, width, depth, height, color, visual.
export function createCustomObjectType({ name, category, width, depth, height, color, visual }, objectTypes) {
  let id = `custom_${(name || 'object').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
  if (!id || id === 'custom_') id = 'custom_object';
  while (objectTypes[id]) {
    id = `custom_${customTypeSeq++}`;
  }
  return {
    id,
    name: name || 'Custom object',
    category: category || 'other',
    width: width > 0 ? width : HARD_DEFAULT.width,
    depth: depth > 0 ? depth : HARD_DEFAULT.depth,
    height: height > 0 ? height : HARD_DEFAULT.height,
    color: color || HARD_DEFAULT.color,
    visual: visual || { type: 'rectangle' },
  };
}
