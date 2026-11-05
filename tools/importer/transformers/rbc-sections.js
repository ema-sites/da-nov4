/* eslint-disable */
/* global WebImporter */

/**
 * RBC Royal Bank sections transformer.
 * beforeTransform: inserts <hr> section breaks (and temporary markers for
 * styled sections) while the original section elements still exist.
 * afterTransform: emits Section Metadata blocks for styled sections.
 */

const MARKER_ATTR = 'data-excat-section-id';

function findSectionElement(root, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (const sel of selectors) {
    if (!sel) continue;
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // invalid selector in this environment, try next
    }
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const sections = payload && payload.template && payload.template.sections;
  if (!sections || sections.length < 2) return;
  const doc = element.ownerDocument || document;

  if (hookName === 'beforeTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const el = findSectionElement(element, section);
      if (!el || !el.parentNode) continue;
      // First section only needs an <hr> (temporary) when it is styled.
      if (i === 0 && !section.style) continue;
      const hr = doc.createElement('hr');
      if (section.style) hr.setAttribute(MARKER_ATTR, section.id);
      el.parentNode.insertBefore(hr, el);
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!section.style) continue;
      const marker = element.querySelector(`hr[${MARKER_ATTR}="${section.id}"]`);
      const anchor = marker || findSectionElement(element, section);
      if (!anchor || !anchor.parentNode) continue;
      const meta = WebImporter.Blocks.createBlock(doc, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });
      anchor.parentNode.insertBefore(meta, anchor.nextSibling);
      if (marker) {
        if (i === 0) marker.remove();
        else marker.removeAttribute(MARKER_ATTR);
      }
    }
  }
}
