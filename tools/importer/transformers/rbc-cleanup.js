/* eslint-disable */
/* global WebImporter */

/**
 * RBC Royal Bank cleanup transformer.
 * Removes non-authorable site chrome, consent/tracking widgets and
 * duplicate mobile-only markup. Selectors come from migration-work/cleaned.html.
 */

// Chrome and widgets that must go before parsers run (affects block matching).
const BEFORE_SELECTORS = [
  // Site header: smart app banner, skip-nav, top nav, search bar, mega menu
  '#dvl-wpr > header',
  '#smart-bnr-rbcapp',
  '#skip-nav',
  '#nav-header',
  '#header.master-header',
  '#search-bar',
  '.mega-menu-wpr',
  // Off-canvas mobile side menu
  '#side-menu-id',
  // Footer
  '#dvl-wpr > footer',
  // OneTrust cookie banner / preference center
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '#onetrust-pc-sdk',
  '[id^="ot-sdk"]',
  // jQuery UI search autocomplete lists
  'ul.ui-autocomplete',
  // UserWay accessibility badge / feedback tab widgets
  'uws-badge',
  '[id^="kampyle"]',
  '.kampyle_vertical_button',
  '[id^="QSIFeedbackButton"]',
  '.feedback-tab',
  '#feedback-tab',
  // Tracking pixels and helper nodes
  '[id^="batBeacon"]',
  '.high-contrast-test',
  'body > div.hide',
  // Mobile-only duplicate of the bento grid (desktop .bento-box is the block)
  '#bento-section .glider-wpr',
  // Empty placeholder div
  '#test-wp',
];

// Final cleanup after parsers have run.
const AFTER_SELECTORS = [
  'iframe',
  'script',
  'style',
  'noscript',
  'link',
  'img[src*="bat.bing.com"]',
  'img[src*="doubleclick.net"]',
  'img[src*="facebook.com/tr"]',
];

const TRACKING_ATTRS = [
  'data-dig-id',
  'data-dig-label',
  'data-dig-category',
  'data-dig-action',
  'data-dig-details',
  'onclick',
];

export default function transform(hookName, element, payload) {
  if (hookName === 'beforeTransform') {
    WebImporter.DOMUtils.remove(element, BEFORE_SELECTORS);
  }

  if (hookName === 'afterTransform') {
    WebImporter.DOMUtils.remove(element, AFTER_SELECTORS);
    // The importer turns background-image into an <img>, but a layered value
    // (url(...), linear-gradient(... 50% ...)) becomes one malformed src.
    // Keep only the first url() layer; drop gradient-only backgrounds.
    element.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const bg = el.style.backgroundImage || '';
      if (!bg.includes(',') && /^url\(/.test(bg.trim())) return;
      const url = bg.match(/url\((['"]?)(.*?)\1\)/);
      if (url && url[2] && !url[2].startsWith('data:')) {
        el.style.backgroundImage = `url("${url[2]}")`;
      } else {
        el.style.removeProperty('background-image');
      }
    });
    element.querySelectorAll('*').forEach((el) => {
      TRACKING_ATTRS.forEach((attr) => {
        if (el.hasAttribute(attr)) el.removeAttribute(attr);
      });
    });
  }
}
