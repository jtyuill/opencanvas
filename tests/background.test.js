const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const site = require("../src/site.js");

const backgroundSource = fs.readFileSync(path.join(__dirname, "../src/background.js"), "utf8");

function loadBackground() {
  let registration = null;
  let stored = { schoolBaseUrl: "" };
  const removedOrigins = [];
  const reloadedTabs = [];
  const listeners = {};
  const chrome = {
    scripting: {
      async getRegisteredContentScripts() { return registration ? [registration] : []; },
      async unregisterContentScripts() { registration = null; },
      async registerContentScripts(scripts) { [registration] = scripts; }
    },
    permissions: {
      async contains({ origins }) { return origins[0] === "https://canvas.school.edu/*"; },
      async remove({ origins }) { removedOrigins.push(...origins); return true; }
    },
    storage: {
      sync: {
        async get(defaults) { return { ...defaults, ...stored }; },
        async set(changes) { stored = { ...stored, ...changes }; }
      },
      onChanged: { addListener(listener) { listeners.storage = listener; } }
    },
    tabs: {
      async query() { return [{ id: 7 }]; },
      async reload(id) { reloadedTabs.push(id); }
    },
    runtime: {
      onInstalled: { addListener(listener) { listeners.installed = listener; } },
      onStartup: { addListener(listener) { listeners.startup = listener; } },
      onMessage: { addListener(listener) { listeners.message = listener; } }
    }
  };
  vm.runInNewContext(backgroundSource, {
    chrome,
    OpenCanvasSite: site,
    importScripts() {}
  });
  return {
    listeners,
    reloadedTabs,
    removedOrigins,
    get registration() { return registration; },
    get stored() { return stored; }
  };
}

test("background registers OpenCanvas only for the granted school origin", async () => {
  const harness = loadBackground();
  const response = await new Promise((resolve) => {
    const asynchronous = harness.listeners.message(
      { type: "opencanvas:set-school", baseUrl: "https://canvas.school.edu/courses" },
      {},
      resolve
    );
    assert.equal(asynchronous, true);
  });

  assert.equal(response.ok, true);
  assert.equal(response.baseUrl, "https://canvas.school.edu");
  assert.equal(harness.stored.schoolBaseUrl, "https://canvas.school.edu");
  assert.equal(harness.registration.matches[0], "https://canvas.school.edu/*");
  assert.equal([...harness.registration.js].join(","), "src/palette.js,src/inline-color.js,src/content.js,src/card-images.js,src/assignment-export.js");
  assert.equal([...harness.registration.css].join(","), "src/theme.css");
  assert.equal(harness.registration.runAt, "document_start");
  assert.deepEqual(harness.reloadedTabs, [7]);
});
