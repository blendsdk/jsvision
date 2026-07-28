---
title: Localized Theme Designer
description: A Dutch JSVision application sharing one translation service across framework packages.
---

# Localized Theme Designer

This headless-safe application imports one Dutch catalog from each framework package, adds its
application catalog last, and injects the shared service into `createApplication`.

The action row measures the complete translated Button group before placement, so the widest Dutch
caption determines equal sibling widths instead of relying on English-sized rectangles. For the
broader locale and viewport sweep, run `yarn workspace @jsvision/examples demo:i18n`; the harness
reconstructs a fresh `I18n` service and `Application` for each typed story selection.

<PlayExample id="theming/i18n-theme-designer" title="Localized Theme Designer" blurb="One Dutch translation service shared by the application and every framework package." />
