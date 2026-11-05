/* eslint-disable */
/* global WebImporter */

import carouselHeroParser from './parsers/carousel-hero.js';
import promoMosaicParser from './parsers/promo-mosaic.js';
import columnsResourcesParser from './parsers/columns-resources.js';
import cardsProductParser from './parsers/cards-product.js';
import columnsMediaParser from './parsers/columns-media.js';
import cardsArticleParser from './parsers/cards-article.js';
import columnsTextParser from './parsers/columns-text.js';
import accordionFaqParser from './parsers/accordion-faq.js';
import searchSiteParser from './parsers/search-site.js';
import branchLocatorParser from './parsers/branch-locator.js';
import accordionLegalParser from './parsers/accordion-legal.js';

import rbcCleanupTransformer from './transformers/rbc-cleanup.js';
import rbcSectionsTransformer from './transformers/rbc-sections.js';

const PAGE_TEMPLATE = {
  "name": "homepage",
  "urls": [
    "https://www.rbcroyalbank.com/",
    "https://www.rbcroyalbank.com/business/accounts/digital-choice-business-account.html",
    "https://www.rbcroyalbank.com/business/advice/IBOR-transition-disclosure.html",
    "https://www.rbcroyalbank.com/business/index.html",
    "https://www.rbcroyalbank.com/business/onboarding/international-trade-finance/global-trade.html",
    "https://www.rbcroyalbank.com/business/paying-and-receiving/index.html",
    "https://www.rbcroyalbank.com/business/paying-and-receiving/payedge/how-it-works.html",
    "https://www.rbcroyalbank.com/business/paying-and-receiving/payedge/index.html",
    "https://www.rbcroyalbank.com/caribbean/",
    "https://www.rbcroyalbank.com/healthcare/en/index.html",
    "https://www.rbcroyalbank.com/personal.html"
  ],
  "coverageGaps": [],
  "description": "Section homepage that opens with a full-width hero carousel with thumbnail tabs, followed by feature card grids, promo banners, article cards, quick links and a locator search",
  "blocks": [
    {
      "name": "carousel-hero",
      "instances": [
        "#hero-carousel-region",
        ".banner-container .hero-carousel-container"
      ]
    },
    {
      "name": "promo-mosaic",
      "instances": [
        "#bento-section .bento-box",
        ".bento-box"
      ]
    },
    {
      "name": "columns-resources",
      "instances": [
        "#welcome-to-rbc ~ .grid-wpr"
      ]
    },
    {
      "name": "cards-product",
      "instances": [
        ".awards-and-recognition-section .award-tiles"
      ]
    },
    {
      "name": "columns-media",
      "instances": [
        ".bank-with-rbc-mobile"
      ]
    },
    {
      "name": "cards-article",
      "instances": [
        ".discover-and-learn-section .grid-wpr.eh-wpr"
      ]
    },
    {
      "name": "columns-text",
      "instances": [
        ".help-section ul.col-wpr"
      ]
    },
    {
      "name": "accordion-faq",
      "instances": [
        "#help-accordion"
      ]
    },
    {
      "name": "search-site",
      "instances": [
        "#intellResponse_form"
      ]
    },
    {
      "name": "branch-locator",
      "instances": [
        ".branch-locator-section .section-inner"
      ]
    },
    {
      "name": "accordion-legal",
      "instances": [
        "section.disclaimer .section-inner"
      ]
    }
  ],
  "sections": [
    {
      "id": "rc1",
      "name": "Hero offers carousel",
      "selector": [
        "main > div.banner-container",
        "#dvl-wpr > main > div.banner-container"
      ],
      "style": "light-grey",
      "blocks": [
        "carousel-hero"
      ],
      "defaultContent": []
    },
    {
      "id": "rc2",
      "name": "Choose RBC with confidence",
      "selector": [
        "#bento-section"
      ],
      "style": "dark-blue-gradient, centered",
      "blocks": [
        "promo-mosaic"
      ],
      "defaultContent": [
        "#bento-section > .section-inner > h2",
        "#bento-section a.btn"
      ]
    },
    {
      "id": "rc3",
      "name": "Welcome to RBC Personal Banking",
      "selector": [
        "main > section:has(#welcome-to-rbc)",
        "#dvl-wpr > main > section:nth-of-type(2)"
      ],
      "style": "light-grey, centered",
      "blocks": [
        "columns-resources"
      ],
      "defaultContent": [
        "#welcome-to-rbc",
        "#welcome-to-rbc + p"
      ]
    },
    {
      "id": "rc4",
      "name": "RBC Awards & Recognition",
      "selector": [
        "main > section.awards-and-recognition-section"
      ],
      "style": "light-blue-grey, centered",
      "blocks": [
        "cards-product"
      ],
      "defaultContent": [
        ".awards-and-recognition-section .section-inner > h2",
        ".awards-and-recognition-section .section-inner > p"
      ]
    },
    {
      "id": "rc5",
      "name": "RBC Mobile app banner",
      "selector": [
        "main > section:has(.bank-with-rbc-mobile)",
        "#dvl-wpr > main > section.pad-tb-dbl"
      ],
      "style": null,
      "blocks": [
        "columns-media"
      ],
      "defaultContent": []
    },
    {
      "id": "rc6",
      "name": "My Money Matters",
      "selector": [
        "main > section.discover-and-learn-section"
      ],
      "style": "light-grey, centered",
      "blocks": [
        "cards-article"
      ],
      "defaultContent": [
        ".discover-and-learn-section .section-inner > h2",
        ".discover-and-learn-section .section-inner > p",
        ".discover-and-learn-section .section-inner > div.text-center"
      ]
    },
    {
      "id": "rc7",
      "name": "How can we help you today?",
      "selector": [
        "main > section.help-section"
      ],
      "style": "centered",
      "blocks": [
        "columns-text",
        "accordion-faq",
        "search-site"
      ],
      "defaultContent": [
        ".help-section .section-inner > h2"
      ]
    },
    {
      "id": "rc8",
      "name": "Find a Branch or ATM",
      "selector": [
        "main > section.branch-locator-section"
      ],
      "style": null,
      "blocks": [
        "branch-locator"
      ],
      "defaultContent": []
    },
    {
      "id": "rc9",
      "name": "Legal disclaimers",
      "selector": [
        "#dvl-wpr > section.disclaimer",
        "section.disclaimer"
      ],
      "style": null,
      "blocks": [
        "accordion-legal"
      ],
      "defaultContent": []
    }
  ]
};

const parsers = {
  'carousel-hero': carouselHeroParser,
  'promo-mosaic': promoMosaicParser,
  'columns-resources': columnsResourcesParser,
  'cards-product': cardsProductParser,
  'columns-media': columnsMediaParser,
  'cards-article': cardsArticleParser,
  'columns-text': columnsTextParser,
  'accordion-faq': accordionFaqParser,
  'search-site': searchSiteParser,
  'branch-locator': branchLocatorParser,
  'accordion-legal': accordionLegalParser,
};

const transformers = [rbcCleanupTransformer, rbcSectionsTransformer];

function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); } catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        pageBlocks.push({ name: blockDef.name, selector, element });
      });
    });
  });
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); } catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    main.appendChild(document.createElement('hr'));
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }];
  },
};
