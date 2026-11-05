/* eslint-disable */
/* global WebImporter */

/**
 * RBC automatic sections transformer — for templates without mapped sections.
 * Every top-level page <section> becomes an EDS section; its background colour
 * becomes a Section Metadata style using the project's section style names.
 * No-op when the template already maps sections (rbc-sections.js handles those).
 */

const MARKER_ATTR = 'data-excat-auto-section';

function styleFor(el) {
  const cs = el.ownerDocument.defaultView.getComputedStyle(el);
  const bg = cs.backgroundColor.replace(/\s+/g, '');
  const img = cs.backgroundImage || '';
  if (/gradient/.test(img) && /0,49,104|0,30,67|0,81,165/.test(img.replace(/\s+/g, ''))) return 'dark-blue-gradient';
  if (['rgb(250,250,250)', 'rgb(249,249,249)', 'rgb(247,247,247)', 'rgb(245,248,249)', 'rgb(248,248,248)'].includes(bg)) return 'light-grey';
  if (['rgb(243,247,248)', 'rgb(237,247,252)', 'rgb(236,247,251)'].includes(bg)) return 'light-blue-grey';
  return null;
}

function pageSections(element) {
  const main = element.querySelector('main') || element;
  const list = [...main.querySelectorAll(':scope > section, :scope > div.banner-container')];
  // disclaimers often sit outside <main>
  element.querySelectorAll('#dvl-wpr > section').forEach((s) => { if (!list.includes(s)) list.push(s); });
  return list.filter((s) => s.textContent.trim() || s.querySelector('img'));
}

export default function transform(hookName, element, payload) {
  const mapped = payload && payload.template && payload.template.sections;
  if (mapped && mapped.length >= 2) return;
  const doc = element.ownerDocument || document;

  if (hookName === 'beforeTransform') {
    const sections = pageSections(element);
    if (sections.length < 2) return;
    sections.forEach((el, i) => {
      const style = styleFor(el);
      if (i === 0 && !style) return;
      const hr = doc.createElement('hr');
      if (style) hr.setAttribute(MARKER_ATTR, style);
      if (i === 0) hr.setAttribute('data-excat-first', '1');
      el.parentNode.insertBefore(hr, el);
    });
  }

  if (hookName === 'afterTransform') {
    element.querySelectorAll(`hr[${MARKER_ATTR}]`).forEach((marker) => {
      const style = marker.getAttribute(MARKER_ATTR);
      const meta = WebImporter.Blocks.createBlock(doc, { name: 'Section Metadata', cells: { style } });
      marker.parentNode.insertBefore(meta, marker.nextSibling);
      if (marker.hasAttribute('data-excat-first')) marker.remove();
      else {
        marker.removeAttribute(MARKER_ATTR);
      }
    });
  }
}
