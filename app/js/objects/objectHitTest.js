// objects/objectHitTest.js — hit-testing for generic placed objects.
// Rotation-aware: uses pointInsideRotatedRectangle rather than an
// axis-aligned bounding box, so a rotated object only reports a hit where it
// is actually drawn (unlike editor.js's legacy hitTest(), which is pure AABB
// and is fine for axis-aligned zones/racks but wrong for arbitrary rotation).

import { pointInsideRotatedRectangle, objectBounds } from '../geometry.js';
import { resolveObject } from './objectFactory.js';

function footprint(obj, objectTypes) {
  const resolved = resolveObject(obj, objectTypes);
  return { x: obj.x, y: obj.y, rotation: obj.rotation || 0, width: resolved.width, depth: resolved.depth };
}

// Returns the topmost placed object hit by world point (x, y), or null.
// Iterates back-to-front so later (visually on-top) objects win ties.
export function hitTestObjects(x, y, objects, objectTypes) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (pointInsideRotatedRectangle(x, y, footprint(obj, objectTypes))) return obj;
  }
  return null;
}

// World-space bounding box for one placed object (post-rotation), used for
// zoom-to-fit and broad-phase overlap checks.
export function boundsOfObject(obj, objectTypes) {
  return objectBounds(footprint(obj, objectTypes));
}
