const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const css = fs.readFileSync(path.join(root, "src/theme.css"), "utf8");
const fixture = fs.readFileSync(path.join(root, "tests/fixtures/canvas-surfaces.html"), "utf8");
const popupCss = fs.readFileSync(path.join(root, "popup/popup.css"), "utf8");
const backgroundSource = fs.readFileSync(path.join(root, "src/background.js"), "utf8");

test("manifest uses optional per-school access", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "OpenCanvas");
  assert.deepEqual(manifest.permissions, ["storage", "scripting"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.background.service_worker, "src/background.js");
});

test("every file referenced by the manifest exists", () => {
  const referencedFiles = [
    manifest.action.default_popup,
    manifest.background.service_worker,
    "src/site.js",
    "src/theme.css",
    "src/palette.js",
    "src/inline-color.js",
    "src/content.js",
    "src/card-images.js"
  ];
  referencedFiles.forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), file));
});

test("inline color repair loads before the content controller", () => {
  assert.ok(backgroundSource.indexOf('"src/inline-color.js"') < backgroundSource.indexOf('"src/content.js"'));
  assert.match(backgroundSource, /runAt:\s*"document_start"/);
  assert.match(backgroundSource, /persistAcrossSessions:\s*true/);
});

test("theme covers representative Canvas fixture surfaces and stable modern hooks", () => {
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
    "#grades_summary a.toggle_score_details_link",
    "#grades_summary a.toggle_score_details_link i::before",
    "#grades_summary .score_details_table",
    "#grades_summary .score_details_table svg :is(line, rect)",
    "#grades_summary .score_details_table svg rect.mid50",
    "#grades_summary .score_details_table svg rect.myScore",
    ".react-rubric",
    ".Button--primary",
    ".ic-notification--warning",
    "[role=\"dialog\"]",
    "[role=\"menu\"]",
    "[role=\"tooltip\"]",
    ".al-options",
    ".courses-tray",
    ".courses-tray [data-cid~=\"Link\"]",
    ".courses-tray [data-cid~=\"ListItem\"] > div",
    ".courses-tray hr",
    "#mobileContextNavContainer",
    "[data-cid~=\"BaseButton\"]",
    "[data-cid~=\"RadioInputGroup\"]",
    "[data-cid~=\"RadioInput\"]",
    "[data-cid~=\"Pill\"]",
    "[data-testid=\"todo-item-metadata\"]",
    "#global_nav_conversations_link .menu-item__badge",
    "#mobileHeaderInboxUnreadBadge",
    "[data-testid=\"grade-status-pill\"]",
    "[data-testid=\"message-preview\"]",
    "[data-testid=\"assignment-toggle\"]",
    "[data-testid=\"assignments-2-student-view\"]",
    "[data-testid=\"title\"]",
    "[data-testid=\"grade-display\"]",
    "[data-testid=\"submission-workflow-tracker-title\"]",
    "[data-testid=\"assignments-2-assignment-description\"]",
    "[data-testid=\"rubric-preview\"]",
    "[data-testid=\"rubric-assessment-traditional-view\"] :is(table, tbody, tr, td)",
    "[data-testid=\"rubric-tab\"] [data-cid~=\"Select\"]",
    "button[data-testid^=\"traditional-criterion-\"]",
    "[data-testid=\"uploaded_files_table\"]",
    "[data-testid=\"student-footer\"]",
    "#student-grades-right-content",
    "#calendar-app",
    ".fc-unthemed .fc-day",
    ".fc-widget-header",
    ".fc-widget-content",
    ".fc-button",
    ".fc-button-link",
    ".fc-event",
    ".conversations",
    "[data-testid=\"discussion-connected-container\"]",
    "[data-testid=\"tool-bar\"]",
    "[data-testid=\"ff-table-row\"]",
    "tr.access_token",
    "[data-ct-inline-color-repair]"
  ];
  requiredSelectors.forEach((selector) => assert.ok(css.includes(selector), selector));

  const fixtureHooks = [
    ["application shell", 'id="application"'],
    ["dashboard todo list", 'data-testid="dashboard-todo-list"'],
    ["dashboard todo info", 'class="ToDoSidebarItem__Info"'],
    ["dashboard todo metadata", 'data-testid="todo-item-metadata"'],
    ["inbox unread badge", 'class="menu-item__badge"'],
    ["assignment radio group", 'data-cid="RadioInputGroup"'],
    ["assignment radio input", 'data-cid="RadioInput"'],
    ["grade status pill", 'data-testid="grade-status-pill"'],
    ["grades stats control", 'class="toggle_score_details_link"'],
    ["grades box plot", 'score_details_table'],
    ["assignment toggle", 'data-testid="assignment-toggle"'],
    ["modern assignment view", 'data-testid="assignments-2-student-view"'],
    ["modern assignment title", 'data-testid="title"'],
    ["modern assignment grade", 'data-testid="grade-display"'],
    ["assignment workflow", 'data-testid="submission-workflow-tracker"'],
    ["assignment description", 'data-testid="assignments-2-assignment-description"'],
    ["assignment rubric preview", 'data-testid="rubric-preview"'],
    ["assignment rubric table", 'class="assignment-rubric-table"'],
    ["assignment rubric rating", 'data-testid="traditional-criterion-1-ratings-0"'],
    ["assignment files table", 'data-testid="uploaded_files_table"'],
    ["assignment footer", 'data-testid="student-footer"'],
    ["calendar widget header", 'class="fc-widget-header"'],
    ["calendar widget content", 'class="fc-widget-content"'],
    ["calendar button", 'class="fc-button"'],
    ["calendar link button", 'class="fc-button-link"'],
    ["course-colored calendar event", 'class="fc-event"'],
    ["courses tray", 'class="navigation-tray-container courses-tray"'],
    ["courses tray metadata", 'data-cid="ListItem"'],
    ["inbox message preview", 'data-testid="message-preview"']
  ];
  fixtureHooks.forEach(([label, marker]) => assert.ok(fixture.includes(marker), label));
});

test("theme is gated, print-safe, and does not invert media", () => {
  assert.match(css, /html\[data-canvas-theme="dark"\]/);
  assert.match(css, /@media print/);
  assert.match(css, /html\[data-canvas-theme="dark"\] \.pages\.show \.show-content/);
  assert.match(css, /html\[data-canvas-theme="dark"\] #course_syllabus/);
  assert.doesNotMatch(css, /filter:\s*invert/i);
  assert.doesNotMatch(css, /html\[data-canvas-theme="dark"\]\s+\*/);
});

test("popup declares a stable extension viewport width", () => {
  assert.match(popupCss, /body\s*\{[^}]*width:\s*360px;/s);
  assert.doesNotMatch(popupCss, /width:\s*min\([^;]*100vw/);
});
