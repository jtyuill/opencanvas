const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const palette = require("../src/palette.js");

const popupSource = fs.readFileSync(path.join(__dirname, "../popup/popup.js"), "utf8");

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
  }

  addEventListener(type, listener) { this.listeners[type] = listener; }
  append() {}
  querySelectorAll() { return []; }
}

function loadPopup({ tabResponse = { available: true, active: true }, loadError = false, saveError = false } = {}) {
  const selectors = [
    "#enabled", "#palette-select", "#color-grid", "#status-dot", "#status-text",
    "#contrast", "#preview", "#reset", "#custom-section", "#storage-error"
  ];
  const elements = Object.fromEntries(selectors.map((selector) => [selector, new FakeElement()]));
  const storageListeners = [];
  let lastError = null;
  const chrome = {
    runtime: {
      get lastError() { return lastError; }
    },
    storage: {
      sync: {
        get(defaults, callback) {
          lastError = loadError ? { message: "load failed" } : null;
          callback(defaults);
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
    tabs: {
      query(options, callback) { callback([{ id: 42 }]); },
      sendMessage(tabId, message, options, callback) { callback(tabResponse); }
    }
  };
  const document = {
    querySelector(selector) { return elements[selector]; },
    createElement() { return new FakeElement(); }
  };

  vm.runInNewContext(popupSource, { CanvasPalette: palette, chrome, document });
  return { elements, storageListeners };
}

test("popup reports confirmed Canvas tab state", () => {
  const { elements } = loadPopup();
  assert.equal(elements["#status-text"].textContent, "Active on this Canvas tab");
  assert.equal(elements["#status-dot"].classList.values.has("active"), true);
  assert.ok(elements["#preview"].style.values["--preview-raised"]);
  assert.ok(elements["#preview"].style.values["--preview-accent-text"]);
});

test("popup distinguishes unavailable tabs", () => {
  const { elements } = loadPopup({ tabResponse: null });
  assert.equal(elements["#status-text"].textContent, "Unavailable on this tab");
  assert.equal(elements["#status-dot"].classList.values.has("active"), false);
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
