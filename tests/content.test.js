const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const palette = require("../src/palette.js");

const contentSource = fs.readFileSync(path.join(__dirname, "../src/content.js"), "utf8");

function loadContentScript(initialSettings) {
  const properties = new Map();
  const root = {
    dataset: {},
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); }
    }
  };
  const listeners = [];
  const messageListeners = [];
  const repairCalls = [];
  let stored = initialSettings;
  const chrome = {
    runtime: {
      lastError: null,
      onMessage: {
        addListener(listener) { messageListeners.push(listener); }
      }
    },
    storage: {
      sync: {
        get(defaults, callback) { callback({ ...defaults, ...stored }); }
      },
      onChanged: {
        addListener(listener) { listeners.push(listener); }
      }
    }
  };

  vm.runInNewContext(contentSource, {
    CanvasPalette: palette,
    CanvasInlineColorRepair: {
      create() {
        return { applyTheme(value) { repairCalls.push(value); } };
      }
    },
    document: { documentElement: root },
    chrome,
    getComputedStyle() {},
    MutationObserver: class {}
  });

  return {
    root,
    properties,
    repairCalls,
    getStatus() {
      let response;
      messageListeners[0]({ type: "canvas-palette:get-status" }, {}, (value) => { response = value; });
      return response;
    },
    update(nextSettings, areaName = "sync") {
      stored = nextSettings;
      listeners[0]({}, areaName);
    }
  };
}

test("applies a selected palette to the document root", () => {
  const customPalette = { ...palette.DARK_PALETTE, accent: "#25c2a0" };
  const harness = loadContentScript({
    enabled: true,
    selectedPalette: "custom",
    customPalette
  });

  assert.equal(harness.root.dataset.canvasTheme, "dark");
  assert.equal(harness.properties.get("--ct-accent"), "#25c2a0");
  assert.equal(harness.properties.get("--ct-background"), palette.DARK_PALETTE.background);
  assert.equal(harness.getStatus().available, true);
  assert.equal(harness.getStatus().active, true);
  assert.equal(harness.repairCalls.at(-1).text, customPalette.text);
});

test("removes the theme and all variables when disabled", () => {
  const harness = loadContentScript(palette.DEFAULT_SETTINGS);
  harness.update({ ...palette.DEFAULT_SETTINGS, enabled: false });

  assert.equal(harness.root.dataset.canvasTheme, undefined);
  assert.equal(harness.properties.size, 0);
  assert.equal(harness.repairCalls.at(-1), null);
  assert.equal(harness.getStatus().available, true);
  assert.equal(harness.getStatus().active, false);
});

test("ignores changes from unrelated storage areas", () => {
  const harness = loadContentScript(palette.DEFAULT_SETTINGS);
  harness.update({ ...palette.DEFAULT_SETTINGS, enabled: false }, "local");

  assert.equal(harness.root.dataset.canvasTheme, "dark");
});
