// objects/objectRenderer2d.js — draws one resolved object on the 2D canvas.
//
// Pure rendering: takes already-resolved dimensions/visual (see
// objectFactory.resolveObject) plus the screen-transform helpers from
// editor.js (sx, sy, z), so it has no dependency on the editor's state shape.
//
// Rotation: ctx.rotate(-theta) here is the mirror image of the +theta
// convention used in geometry.js / preview3d.js. Proof: screen position is
// S(x,y) = (a*x + px0, -a*y + py0) (sy() negates y), a reflection. Composing
// that reflection with a world rotation by +theta is equivalent, in the
// canvas's own (unreflected) rotate(), to rotating by -theta — see the
// comment above getRotatedCorners() in geometry.js for the full derivation.
// Because the rectangle is symmetric about its centre this sign only matters
// for asymmetric content (images), which is why it's called out explicitly
// here rather than left implicit.

import { degToRad } from '../geometry.js';

// getImage(source) -> HTMLImageElement | null. Called every frame; may
// return null while an asset is loading (renderer falls back to a plain
// rectangle for that frame) — see assets/imageLoader.js.
export function drawObject2d(ctx, obj, resolved, { sx, sy, z }, getImage, selected) {
  const w = resolved.width * z;
  const d = resolved.depth * z;

  ctx.save();
  ctx.translate(sx(obj.x), sy(obj.y));
  ctx.rotate(-degToRad(obj.rotation || 0));

  const visual = resolved.visual || { type: 'rectangle' };
  let drew = false;
  if ((visual.type === 'image' || visual.type === 'svg' || visual.type === 'billboard') && visual.source) {
    const img = getImage(visual.source);
    if (img) {
      drawFittedImage(ctx, img, w, d, visual.fit || 'contain');
      drew = true;
    }
  }
  // model3d has no sensible flat 2D depiction beyond its footprint, so it
  // (and any image that failed/hasn't loaded yet) falls back to a rectangle.
  if (!drew) {
    ctx.fillStyle = resolved.color + (selected ? 'cc' : '88');
    ctx.fillRect(-w / 2, -d / 2, w, d);
  }

  ctx.strokeStyle = selected ? '#5fa8e8' : '#10141a';
  ctx.lineWidth = selected ? 2.5 : 1;
  ctx.strokeRect(-w / 2, -d / 2, w, d);

  // A short heading tick on the +width edge so rotation reads clearly even
  // when the fill is a photo with no obvious "front".
  ctx.strokeStyle = selected ? '#5fa8e8' : '#9aa6b3';
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2 + Math.min(10, w * 0.2), 0);
  ctx.stroke();

  ctx.restore();
}

function drawFittedImage(ctx, img, boxW, boxD, fit) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = fit === 'cover' ? Math.max(boxW / iw, boxD / ih) : Math.min(boxW / iw, boxD / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  if (fit === 'cover') {
    ctx.beginPath();
    ctx.rect(-boxW / 2, -boxD / 2, boxW, boxD);
    ctx.clip();
  }
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}
