# OpenCanvas

A dependency-free Chromium extension that adds dark mode and custom palettes to your school's Canvas site.

## Features

- Two presets: **Standard Black** and **Tokyo Night**, plus a fully editable **Custom** palette.
- Seven editable custom colors with live updates across open Canvas tabs.
- Multi-role WCAG contrast feedback for text, muted text, links, buttons, focus indicators, borders, and semantic states.
- Canvas-owned coverage for dashboards, course navigation, modules, assignments, discussions, pages, grades, calendar, inbox, settings, forms, dialogs, notices, loading states, and mobile navigation.
- Conservative repair of unreadable inline text colors in instructor-authored rich content.
- Print-safe light output and no image/video inversion.
- Per-school access: OpenCanvas requests permission only for the HTTPS Canvas origin selected in the popup.

## Install locally

1. Open `chrome://extensions` in Chrome, Chromium, Brave, or Edge.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this repository directory.
4. Open the toolbar popup and enter your school's Canvas base URL, such as `https://canvas.example.edu`.
5. Approve access to that site, then open or refresh Canvas.

Authentication pages and external tools on other origins are intentionally not modified.

## Test

Run the dependency-free checks with:

```sh
npm test
npm run check
```

The tests cover preset and custom palette validation, accessibility contrast, inline-color repair, live storage changes, popup status and errors, manifest permissions and host scope, referenced files, and representative Canvas selectors.

## Authenticated checklist

After connecting your school's Canvas URL and signing in, verify these routes with **Standard Black**, **Tokyo Night**, and a deliberately different custom palette:

- Dashboard: cards, card menus, favorite-course colors, and To Do sidebar.
- Course home: breadcrumbs, course navigation, syllabus, and announcements.
- Modules and assignments: module rows, requirements, submission controls, rubrics, and status notices.
- Discussions: entries, replies, editor toolbar, and nested threads.
- Grades: table headers, alternating rows, score fields, and popovers.
- Calendar and inbox: event blocks, message list, compose dialog, and date picker.
- Account settings: tabs, forms, dialogs, and dropdown menus.
- Rich content: instructor-selected background colors, embedded images, videos, and external-tool iframes.
- Print preview: assignment and syllabus pages should return to white paper with black text.

If Canvas introduces a new surface that remains light, add its stable class or role to `src/theme.css` rather than applying a blanket selector. This avoids overriding instructor-authored course content.

Inline foreground colors inside Canvas `.user_content` regions are preserved unless their computed contrast falls below 3:1 and the palette text color reaches at least 4.5:1. Explicit backgrounds are respected, and content over images or gradients is left unchanged when contrast cannot be determined safely.

Cross-origin external tools such as Panopto, Piazza, Studio, and zyBooks are outside the selected school's permission and cannot be themed. Their surrounding Canvas frames remain themed.

## Palette storage

Settings are stored with `chrome.storage.sync` under four keys:

- `enabled`: whether theming is active.
- `selectedPalette`: a built-in preset ID or `custom`.
- `customPalette`: validated six-digit hex colors for page, surface, raised surface, text, muted text, border, and accent.
- `schoolBaseUrl`: the normalized HTTPS origin selected by the user.

OpenCanvas declares optional HTTPS site access so Chromium can present an origin-specific permission prompt. Only the selected Canvas origin is granted and registered; switching schools removes the previous origin permission.

No page content, credentials, or browsing activity is stored or transmitted. The content script locally checks computed colors for elements with inline foreground colors inside instructor-authored rich-content regions solely to repair unusable contrast.
