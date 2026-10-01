import test from 'node:test';
import assert from 'node:assert/strict';

import {
  degToRad,
  getRotatedCorners,
  worldToObjectLocal,
  pointInsideRotatedRectangle,
  objectBounds,
} from '../../app/js/geometry.js';
import {
  resolveObject,
  nextObjectId,
  createObjectInstance,
  duplicateObjectInstance,
  createCustomObjectType,
} from '../../app/js/objects/objectFactory.js';
import { DEFAULT_OBJECT_TYPES, cloneDefaultObjectTypes } from '../../app/js/objects/objectTypes.js';
import { hitTestObjects, boundsOfObject } from '../../app/js/objects/objectHitTest.js';
import { validateLayout, SCHEMA_VERSION } from '../../app/js/schema.js';
import { migrate } from '../../app/js/migrations.js';

// ── rotation geometry ────────────────────────────────────────────────────────

test('degToRad converts degrees to radians', () => {
  assert.ok(Math.abs(degToRad(180) - Math.PI) < 1e-9);
  assert.equal(degToRad(0), 0);
});

test('getRotatedCorners at rotation 0 matches an axis-aligned box', () => {
  const corners = getRotatedCorners({ x: 10, y: 5, width: 4, depth: 2, rotation: 0 });
  const numSort = (a, b) => a - b;
  const xs = corners.map((c) => +c.x.toFixed(6));
  const ys = corners.map((c) => +c.y.toFixed(6));
  assert.deepEqual(xs.sort(numSort), [8, 8, 12, 12]);
  assert.deepEqual(ys.sort(numSort), [4, 4, 6, 6]);
});

test('getRotatedCorners at rotation 90 swaps width/depth footprint', () => {
  const corners = getRotatedCorners({ x: 0, y: 0, width: 4, depth: 2, rotation: 90 });
  const xs = corners.map((c) => +c.x.toFixed(6));
  const ys = corners.map((c) => +c.y.toFixed(6));
  // width (4) now runs along y, depth (2) along x
  assert.deepEqual([...new Set(xs)].sort((a, b) => a - b), [-1, 1]);
  assert.deepEqual([...new Set(ys)].sort((a, b) => a - b), [-2, 2]);
});

test('worldToObjectLocal is the inverse of the rotation in getRotatedCorners', () => {
  const obj = { x: 3, y: -2, width: 5, depth: 3, rotation: 37 };
  for (const corner of getRotatedCorners(obj)) {
    const { lx, ly } = worldToObjectLocal(corner.x, corner.y, obj);
    assert.ok(Math.abs(Math.abs(lx) - obj.width / 2) < 1e-9);
    assert.ok(Math.abs(Math.abs(ly) - obj.depth / 2) < 1e-9);
  }
});

test('pointInsideRotatedRectangle: centre is always inside, regardless of rotation', () => {
  const obj = { x: 2, y: 2, width: 1, depth: 1, rotation: 137.5 };
  assert.ok(pointInsideRotatedRectangle(2, 2, obj));
});

test('pointInsideRotatedRectangle: a point outside the unrotated box can be inside once rotated', () => {
  const unrotated = { x: 0, y: 0, width: 4, depth: 1, rotation: 0 };
  const rotated90 = { ...unrotated, rotation: 90 };
  // (0.4, 1.9): outside the unrotated 4(x) x 1(y) box, inside once it's rotated
  // 90° (footprint becomes 1(x) x 4(y))
  assert.ok(!pointInsideRotatedRectangle(0.4, 1.9, unrotated));
  assert.ok(pointInsideRotatedRectangle(0.4, 1.9, rotated90));
  // and the reverse point, which was inside, is now outside post-rotation
  assert.ok(pointInsideRotatedRectangle(1.9, 0.4, unrotated));
  assert.ok(!pointInsideRotatedRectangle(1.9, 0.4, rotated90));
});

test('pointInsideRotatedRectangle: arbitrary rotation (45°) at a corner-adjacent point', () => {
  const obj = { x: 0, y: 0, width: 2, depth: 2, rotation: 45 };
  // At 45°, the rotated square's axis-aligned extent along x/y is sqrt(2) ≈ 1.414
  assert.ok(pointInsideRotatedRectangle(1.4, 0, obj));
  assert.ok(!pointInsideRotatedRectangle(1.42, 1.42, obj));
});

test('objectBounds returns the axis-aligned box of a rotated footprint', () => {
  const b = objectBounds({ x: 0, y: 0, width: 4, depth: 2, rotation: 90 });
  assert.ok(Math.abs(b.minX - -1) < 1e-9);
  assert.ok(Math.abs(b.maxX - 1) < 1e-9);
  assert.ok(Math.abs(b.minY - -2) < 1e-9);
  assert.ok(Math.abs(b.maxY - 2) < 1e-9);
});

// ── objectFactory: inheritance fallback (instance -> type -> hard default) ──

test('resolveObject inherits width/depth/height/color from its objectType when unset', () => {
  const types = cloneDefaultObjectTypes();
  const resolved = resolveObject({ id: 'A', type: 'cnc', x: 0, y: 0 }, types);
  assert.equal(resolved.width, DEFAULT_OBJECT_TYPES.cnc.width);
  assert.equal(resolved.depth, DEFAULT_OBJECT_TYPES.cnc.depth);
  assert.equal(resolved.height, DEFAULT_OBJECT_TYPES.cnc.height);
  assert.equal(resolved.color, DEFAULT_OBJECT_TYPES.cnc.color);
});

test('resolveObject lets instance fields override the objectType', () => {
  const types = cloneDefaultObjectTypes();
  const resolved = resolveObject({ id: 'A', type: 'cnc', x: 0, y: 0, width: 9.9, color: '#ffffff' }, types);
  assert.equal(resolved.width, 9.9);
  assert.equal(resolved.color, '#ffffff');
  // depth/height still inherited
  assert.equal(resolved.depth, DEFAULT_OBJECT_TYPES.cnc.depth);
});

test('resolveObject falls back to hard defaults for an unknown/missing objectType', () => {
  const resolved = resolveObject({ id: 'A', type: 'does_not_exist', x: 0, y: 0 }, {});
  assert.equal(resolved.width, 1);
  assert.equal(resolved.depth, 1);
  assert.equal(resolved.height, 1);
  assert.equal(resolved.category, 'other');
});

test('resolveObject visual defaults to fit:contain when not specified', () => {
  const types = cloneDefaultObjectTypes();
  const resolved = resolveObject({ id: 'A', type: 'cnc', x: 0, y: 0 }, types);
  assert.equal(resolved.visual.fit, 'contain');
});

// ── object creation / ids / duplication ──────────────────────────────────────

test('nextObjectId produces sequential, unused ids', () => {
  const objects = [{ id: 'CNC-01' }, { id: 'CNC-02' }];
  assert.equal(nextObjectId('cnc', objects), 'CNC-03');
});

test('createObjectInstance centres a new object at the given point with rotation 0', () => {
  const types = cloneDefaultObjectTypes();
  const obj = createObjectInstance('robot', 5, 7, types, []);
  assert.equal(obj.type, 'robot');
  assert.equal(obj.x, 5);
  assert.equal(obj.y, 7);
  assert.equal(obj.rotation, 0);
  assert.equal(obj.dataBinding.entityId, null);
});

test('duplicateObjectInstance assigns a new id and offsets position', () => {
  const original = { id: 'CNC-01', type: 'cnc', x: 1, y: 1, rotation: 0, name: 'CNC' };
  const dup = duplicateObjectInstance(original, [original]);
  assert.notEqual(dup.id, original.id);
  assert.notEqual(dup.x, original.x);
  assert.equal(dup.type, 'cnc');
});

test('createCustomObjectType derives a slug id from the name and does not collide', () => {
  const types = cloneDefaultObjectTypes();
  const t = createCustomObjectType(
    { name: 'Laser Cutter', category: 'machines', width: 2, depth: 1, height: 1.5, color: '#123456' },
    types,
  );
  assert.equal(t.id, 'custom_laser_cutter');
  assert.equal(t.category, 'machines');
  assert.equal(t.width, 2);
});

// ── rotation-aware hit-testing ────────────────────────────────────────────────

test('hitTestObjects finds an object via its rotated footprint, not its AABB', () => {
  const types = cloneDefaultObjectTypes();
  const objects = [{ id: 'W1', type: 'wall', x: 0, y: 0, rotation: 90 }]; // wall: 3.0 x 0.2
  // (0.05, 1.4) is inside the 90°-rotated wall (now 0.2 wide along x, 3.0 along y)
  assert.equal(hitTestObjects(0.05, 1.4, objects, types).id, 'W1');
  // but outside the UNROTATED footprint extent along y (which would only reach 0.1)
  assert.equal(hitTestObjects(1.4, 0.05, objects, types), null);
});

test('hitTestObjects returns the topmost (last) object on overlap', () => {
  const types = cloneDefaultObjectTypes();
  const objects = [
    { id: 'BOTTOM', type: 'table', x: 0, y: 0, rotation: 0 },
    { id: 'TOP', type: 'table', x: 0, y: 0, rotation: 0 },
  ];
  assert.equal(hitTestObjects(0, 0, objects, types).id, 'TOP');
});

test('hitTestObjects returns null when nothing is hit', () => {
  const types = cloneDefaultObjectTypes();
  assert.equal(hitTestObjects(100, 100, [{ id: 'A', type: 'table', x: 0, y: 0 }], types), null);
});

test('boundsOfObject resolves type dimensions before computing the AABB', () => {
  const types = cloneDefaultObjectTypes();
  const b = boundsOfObject({ id: 'A', type: 'pillar', x: 10, y: 10, rotation: 0 }, types);
  const t = DEFAULT_OBJECT_TYPES.pillar;
  assert.ok(Math.abs(b.maxX - b.minX - t.width) < 1e-9);
  assert.ok(Math.abs(b.maxY - b.minY - t.depth) < 1e-9);
});

// ── schema validation for objectTypes/objects/assets ─────────────────────────

function baseLayout() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { name: 'TEST' },
    naming: { separator: '-', bayPad: 2 },
    binOverrides: {},
    binTypes: {},
    zones: [],
    nodes: [],
    edges: [],
    racks: [],
    objectTypes: cloneDefaultObjectTypes(),
    objects: [],
    assets: {},
  };
}

test('validateLayout accepts an empty-but-present objectTypes/objects/assets', () => {
  const { ok, errors } = validateLayout(baseLayout());
  assert.ok(ok, errors.join('; '));
});

test('validateLayout accepts a well-formed placed object', () => {
  const layout = baseLayout();
  layout.objects.push({ id: 'CNC-01', type: 'cnc', x: 1, y: 1, rotation: 45 });
  const { ok, errors } = validateLayout(layout);
  assert.ok(ok, errors.join('; '));
});

test('validateLayout rejects an object referencing an unknown type', () => {
  const layout = baseLayout();
  layout.objects.push({ id: 'X-01', type: 'nope', x: 0, y: 0 });
  const { ok, errors } = validateLayout(layout);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('is not a defined objectType')));
});

test('validateLayout rejects duplicate object ids', () => {
  const layout = baseLayout();
  layout.objects.push({ id: 'DUP', type: 'cnc', x: 0, y: 0 }, { id: 'DUP', type: 'cnc', x: 1, y: 1 });
  const { ok, errors } = validateLayout(layout);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('is not unique')));
});

test('validateLayout rejects an instance override of width that is not positive', () => {
  const layout = baseLayout();
  layout.objects.push({ id: 'A', type: 'cnc', x: 0, y: 0, width: -1 });
  const { ok, errors } = validateLayout(layout);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('width must be a positive number')));
});

test('validateLayout rejects a visual with an unknown type', () => {
  const layout = baseLayout();
  layout.objects.push({ id: 'A', type: 'cnc', x: 0, y: 0, visual: { type: 'hologram' } });
  const { ok, errors } = validateLayout(layout);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('visual.type must be one of')));
});

test('validateLayout rejects missing objectTypes/objects/assets entirely', () => {
  const layout = baseLayout();
  delete layout.objectTypes;
  delete layout.objects;
  delete layout.assets;
  const { ok, errors } = validateLayout(layout);
  assert.equal(ok, false);
  assert.ok(errors.includes('objectTypes must be an object'));
  assert.ok(errors.includes('objects must be an array'));
  assert.ok(errors.includes('assets must be an object'));
});

// ── migration 6→7 ─────────────────────────────────────────────────────────────

test('migration 6→7 seeds objectTypes/objects/assets without touching existing racks', () => {
  const v6 = {
    meta: { name: 'T', schema_version: 2 },
    editor: { schemaVersion: 6, naming: { separator: '-', bayPad: 2 }, binOverrides: {} },
    settings: { units: 'metres' },
    binTypes: { STD: { w: 3, d: 1, h: 6, color: '#aaa' } },
    zones: [],
    nodes: [],
    edges: [],
    racks: [
      {
        id: 'ROW-A',
        type: 'STD',
        orientation: 'length_along_y',
        bays: 2,
        levels: 1,
        levelHeights: [6],
        rowToken: 'A',
        bayStart: 1,
        bayReverse: false,
        access_face: null,
        back_to_back_spine: null,
        bayLevelOverrides: {},
        x: 0,
        y: 0,
      },
    ],
    bins: [],
    bg: null,
  };
  const up = migrate(v6);
  assert.equal(up.editor.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(up.racks, v6.racks);
  assert.deepEqual(up.objects, []);
  assert.deepEqual(up.assets, {});
  assert.ok(up.objectTypes.cnc, 'built-in objectTypes catalog should be seeded');
});

test('migration 6→7 does not overwrite an already-present objectTypes/objects/assets', () => {
  const v6 = {
    meta: { name: 'T', schema_version: 2 },
    editor: { schemaVersion: 6, naming: { separator: '-', bayPad: 2 }, binOverrides: {} },
    binTypes: {},
    zones: [],
    nodes: [],
    edges: [],
    racks: [],
    bins: [],
    bg: null,
    objectTypes: { foo: { id: 'foo', name: 'Foo', category: 'other', width: 1, depth: 1, height: 1 } },
    objects: [{ id: 'A', type: 'foo', x: 0, y: 0 }],
    assets: { bar: { name: 'bar.png' } },
  };
  const up = migrate(v6);
  assert.deepEqual(up.objectTypes, v6.objectTypes);
  assert.deepEqual(up.objects, v6.objects);
  assert.deepEqual(up.assets, v6.assets);
});
