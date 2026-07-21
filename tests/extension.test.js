const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const css = fs.readFileSync(path.join(root, "src/theme.css"), "utf8");
const popupCss = fs.readFileSync(path.join(root, "popup/popup.css"), "utf8");

test("manifest is valid MV3 and scoped only to UTK Canvas", () => {
  const expectedMatch = "https://utk.instructure.com/*";
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, [expectedMatch]);
  assert.deepEqual(manifest.content_scripts[0].matches, [expectedMatch]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
});

test("every file referenced by the manifest exists", () => {
  const referencedFiles = [
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((script) => [...script.css, ...script.js])
  ];
  referencedFiles.forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), file));
});

test("inline color repair loads before the content controller", () => {
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf("src/inline-color.js") < scripts.indexOf("src/content.js"));
});

test("theme covers representative Canvas fixture surfaces", () => {
  const requiredSelectors = [
    "#application",
    "#left-side",
    "#breadcrumbs",
    "#section-tabs",
    ".ic-Layout-contentMain",
    ".ic-DashboardCard",
    ".item-group-container",
    ".item-group-condensed",
    ".ig-header",
    ".ig-row",
    ".discussion_entry",
    ".ic-Table",
    ".ic-Table--striped",
    ".wiki-page-table",
    "#syllabus",
    "#grades_summary",
    ".react-rubric",
    ".Button--primary",
    ".ic-notification--warning",
    "[role=\"dialog\"]",
    "[role=\"menu\"]",
    "[role=\"tooltip\"]",
    ".al-options",
    "#mobileContextNavContainer",
    "[data-cid~=\"BaseButton\"]",
    "#student-grades-right-content",
    "#calendar-app",
    ".fc-unthemed .fc-day",
    ".conversations",
    "[data-testid=\"discussion-connected-container\"]",
    "[data-testid=\"tool-bar\"]",
    "[data-testid=\"ff-table-row\"]",
    "tr.access_token",
    "[data-ct-inline-color-repair]"
  ];
  requiredSelectors.forEach((selector) => assert.ok(css.includes(selector), selector));
});

test("theme is gated, print-safe, and does not invert media", () => {
  assert.match(css, /html\[data-canvas-theme="dark"\]/);
  assert.match(css, /@media print/);
  assert.doesNotMatch(css, /filter:\s*invert/i);
  assert.doesNotMatch(css, /html\[data-canvas-theme="dark"\]\s+\*/);
});

test("popup declares a stable extension viewport width", () => {
  assert.match(popupCss, /body\s*\{[^}]*width:\s*360px;/s);
  assert.doesNotMatch(popupCss, /width:\s*min\([^;]*100vw/);
});
