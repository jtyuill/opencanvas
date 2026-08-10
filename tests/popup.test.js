const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const palette = require("../src/palette.js");
const site = require("../src/site.js");

const popupSource = fs.readFileSync(path.join(__dirname, "../popup/popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(__dirname, "../popup/popup.html"), "utf8");

test("popup exposes only the supported themes", () => {
  const options = [...popupHtml.matchAll(/<option value="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual(options, ["dark", "tokyo-night", "custom"]);
  assert.match(popupHtml, />Standard Black<\/option>/);
  assert.doesNotMatch(popupHtml, /Access is limited to this Canvas site/);
  assert.doesNotMatch(popupSource, /contrast checks pass/);
});

class FakeElement {
  constructor() {
    this.checked = false;
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.title = "";
    this.dataset = {};
    this.listeners = {};
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
    this.classList = {
      values: new Set(),
      toggle: (name, enabled) => enabled ? this.classList.values.add(name) : this.classList.values.delete(name)
    };
    this.attributes = {};
  }

  addEventListener(type, listener) { this.listeners[type] = listener; }
  append() {}
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelectorAll() { return []; }
}

function loadPopup({
  tabResponse = { available: true, active: true },
  loadError = false,
  saveError = false,
  permissionGranted = true,
  schoolBaseUrl = "https://canvas.example.edu"
} = {}) {
  const selectors = [
    "#enabled", "#palette-select", "#color-grid", "#status-line", "#status-dot", "#status-text",
    "#preview", "#custom-preview", "#reset", "#home-view", "#custom-view", "#edit-custom",
    "#back", "#storage-error", "#site-form", "#school-url", "#connect-site"
  ];
  const elements = Object.fromEntries(selectors.map((selector) => [selector, new FakeElement()]));
  const storageListeners = [];
  const permissionRequests = [];
  let lastError = null;
  const chrome = {
    runtime: {
      get lastError() { return lastError; },
      sendMessage(message, callback) { callback({ ok: true, baseUrl: message.baseUrl }); }
    },
    storage: {
      sync: {
        get(defaults, callback) {
          lastError = loadError ? { message: "load failed" } : null;
          callback({ ...defaults, schoolBaseUrl });
          lastError = null;
        },
        set(changes, callback) {
          lastError = saveError ? { message: "save failed" } : null;
          callback();
          lastError = null;
        }
      },
      onChanged: {
        addListener(listener) { storageListeners.push(listener); }
      }
    },
    permissions: {
      request(request, callback) {
        permissionRequests.push(request);
        callback(permissionGranted);
      }
    },
    tabs: {
      query(options, callback) { callback([{ id: 42 }]); },
      sendMessage(tabId, message, options, callback) { callback(tabResponse); }
    }
  };
  const document = {
    querySelector(selector) { return elements[selector]; },
    createElement() { return new FakeElement(); }
  };

  vm.runInNewContext(popupSource, { CanvasPalette: palette, OpenCanvasSite: site, chrome, document });
  return { elements, storageListeners, permissionRequests };
}

test("popup hides the status line when the theme is active", () => {
  const { elements } = loadPopup();
  assert.equal(elements["#status-line"].hidden, true);
  assert.equal(elements["#status-text"].textContent, "");
  assert.ok(elements["#preview"].style.values["--preview-raised"]);
  assert.ok(elements["#preview"].style.values["--preview-accent-text"]);
});

test("popup opens and closes the custom palette editor", () => {
  const { elements } = loadPopup();
  assert.equal(elements["#home-view"].hidden, false);
  assert.equal(elements["#custom-view"].hidden, true);
  assert.equal(elements["#edit-custom"].hidden, true);

  elements["#palette-select"].value = "custom";
  elements["#palette-select"].listeners.change();
  assert.equal(elements["#home-view"].hidden, true);
  assert.equal(elements["#custom-view"].hidden, false);
  assert.equal(elements["#edit-custom"].hidden, false);
  assert.ok(elements["#custom-preview"].style.values["--preview-background"]);

  elements["#back"].listeners.click();
  assert.equal(elements["#home-view"].hidden, false);
  assert.equal(elements["#custom-view"].hidden, true);

  elements["#edit-custom"].listeners.click();
  assert.equal(elements["#custom-view"].hidden, false);
});

test("popup distinguishes unavailable tabs", () => {
  const { elements } = loadPopup({ tabResponse: null });
  assert.equal(elements["#status-text"].textContent, "Unavailable on this tab");
  assert.equal(elements["#status-dot"].classList.values.has("active"), false);
});

test("popup prompts for a school before checking the active tab", () => {
  const { elements } = loadPopup({ schoolBaseUrl: "" });
  assert.equal(elements["#status-text"].textContent, "Choose your Canvas site");
});

test("popup requests access to the normalized school origin", () => {
  const harness = loadPopup({ schoolBaseUrl: "" });
  harness.elements["#school-url"].value = "canvas.school.edu/courses";
  harness.elements["#site-form"].listeners.submit({ preventDefault() {} });
  assert.equal(harness.elements["#school-url"].value, "https://canvas.school.edu");
  assert.equal(harness.elements["#connect-site"].textContent, "Update");
  assert.equal(harness.permissionRequests[0].origins[0], "https://canvas.school.edu/*");
});

test("popup announces storage load and save failures", () => {
  const loadHarness = loadPopup({ loadError: true });
  assert.equal(loadHarness.elements["#storage-error"].hidden, false);
  assert.match(loadHarness.elements["#storage-error"].textContent, /Could not load/);

  const saveHarness = loadPopup({ saveError: true });
  saveHarness.elements["#enabled"].checked = false;
  saveHarness.elements["#enabled"].listeners.change();
  assert.equal(saveHarness.elements["#enabled"].checked, true);
  assert.match(saveHarness.elements["#storage-error"].textContent, /Could not save/);
});
