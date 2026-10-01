// ui/objectLibrary.js — categorized side-panel library of placeable object
// types, driven entirely by data (objects/objectTypes.js + the live layout's
// own objectTypes map). Adding a new catalog entry means editing
// objectTypes.js (or using the in-panel "custom type" form below) — never
// editor.js.
//
// This module owns no state of its own: editor.js passes accessor/callback
// functions and calls renderObjectLibrary() again whenever something that
// affects the list changes (a new custom type, switching layouts, the active
// placement type).

import { CATEGORIES } from '../objects/objectTypes.js';

// Renders the library into `container`.
//   getObjectTypes()      -> the live layout.objectTypes map
//   getActiveType()       -> the currently-armed placement type key, or null
//   onSelectType(typeKey) -> fired when the user clicks a library item
//   onCreateCustomType(formData) -> fired with { name, category, width,
//                                    depth, height, color } from the form
export function renderObjectLibrary(
  container,
  { getObjectTypes, getActiveType, onSelectType, onCreateCustomType },
) {
  const objectTypes = getObjectTypes();
  const activeType = getActiveType();

  const byCategory = new Map();
  Object.values(objectTypes).forEach((t) => {
    const cat = t.category || 'other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(t);
  });

  const knownIds = new Set(CATEGORIES.map((c) => c.id));
  const orderedCats = [
    ...CATEGORIES,
    ...[...byCategory.keys()].filter((id) => !knownIds.has(id)).map((id) => ({ id, label: id })),
  ];

  let html = '<div class="hintline">Click a type, then click the plan to place it.</div>';
  orderedCats.forEach(({ id, label }) => {
    const types = byCategory.get(id);
    if (!types || !types.length) return;
    html += `<div class="objlib-cat">${label}</div><div class="objlib-grid">`;
    types.forEach((t) => {
      const active = t.id === activeType;
      html += `<button type="button" class="objlib-item${active ? ' active' : ''}" data-type="${t.id}"
        style="--c:${t.color}" title="${t.name} (${t.width}×${t.depth}×${t.height} m)">
        <span class="objlib-sw"></span>${t.name}</button>`;
    });
    html += `</div>`;
  });

  html += `<details class="objlib-custom"><summary>+ Custom object type</summary>
    <div class="field"><label>Name</label><input type="text" id="oc_name"></div>
    <div class="field"><label>Category</label>
      <select id="oc_cat">${CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Width (m)</label><input type="number" id="oc_w" value="1" min="0.05" step="0.05"></div>
    <div class="field"><label>Depth (m)</label><input type="number" id="oc_d" value="1" min="0.05" step="0.05"></div>
    <div class="field"><label>Height (m)</label><input type="number" id="oc_h" value="1" min="0.05" step="0.05"></div>
    <div class="field"><label>Color</label><input type="color" id="oc_color" value="#7a8a9a"></div>
    <div class="btnrow"><button class="btn small" id="oc_add">Add type</button></div>
  </details>`;

  container.innerHTML = html;

  container.querySelectorAll('.objlib-item').forEach((btn) => {
    btn.addEventListener('click', () => onSelectType(btn.dataset.type));
  });

  const addBtn = container.querySelector('#oc_add');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const name = document.getElementById('oc_name').value.trim();
      if (!name) {
        alert('Give the custom type a name.');
        return;
      }
      onCreateCustomType({
        name,
        category: document.getElementById('oc_cat').value,
        width: parseFloat(document.getElementById('oc_w').value),
        depth: parseFloat(document.getElementById('oc_d').value),
        height: parseFloat(document.getElementById('oc_h').value),
        color: document.getElementById('oc_color').value,
      });
    });
  }
}
