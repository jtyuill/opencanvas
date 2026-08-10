const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const cardImages = require("../src/card-images.js");
const source = fs.readFileSync(path.join(__dirname, "../src/card-images.js"), "utf8");

// --- Pure helpers -----------------------------------------------------------

test("courseIdFromHref extracts numeric course ids from card links", () => {
  assert.equal(cardImages.courseIdFromHref("/courses/123"), "123");
  assert.equal(cardImages.courseIdFromHref("/courses/123/assignments/5"), "123");
  assert.equal(cardImages.courseIdFromHref("https://canvas.example.edu/courses/42"), "42");
  assert.equal(cardImages.courseIdFromHref("/calendar"), "");
  assert.equal(cardImages.courseIdFromHref(""), "");
  assert.equal(cardImages.courseIdFromHref(null), "");
});

test("upsertImage merges per-origin course images without mutating input", () => {
  const original = { "https://a.edu": { "1": "one" } };
  const next = cardImages.upsertImage(original, "https://a.edu", "2", "two");
  assert.deepEqual(original, { "https://a.edu": { "1": "one" } });
  assert.deepEqual(next, { "https://a.edu": { "1": "one", "2": "two" } });
  const newOrigin = cardImages.upsertImage(original, "https://b.edu", "9", "nine");
  assert.deepEqual(newOrigin, { "https://a.edu": { "1": "one" }, "https://b.edu": { "9": "nine" } });
});

test("removeImage deletes a course and drops empty origins", () => {
  const store = { "https://a.edu": { "1": "one", "2": "two" } };
  const after = cardImages.removeImage(store, "https://a.edu", "1");
  assert.deepEqual(after, { "https://a.edu": { "2": "two" } });
  assert.deepEqual(cardImages.removeImage(after, "https://a.edu", "2"), {});
  assert.equal(cardImages.removeImage(store, "https://a.edu", "999"), store);
});

// --- Page behavior ----------------------------------------------------------

function matches(el, selector) {
  const sel = selector.trim();
  const idMatch = sel.match(/^#([\w-]+)$/);
  if (idMatch) return el.attrs.id === idMatch[1];
  const attrMatch = sel.match(/^([a-z]+)\[([\w-]+)\*="([^"]*)"\]$/);
  if (attrMatch) {
    const [, tag, attr, sub] = attrMatch;
    if (el.tagName !== tag.toUpperCase()) return false;
    return String(el.attrs[attr] || "").includes(sub);
  }
  const classMatch = sel.match(/^\.([\w-]+)$/);
  if (classMatch) return el.classList.contains(classMatch[1]);
  if (/^[a-z]+$/i.test(sel)) return el.tagName === sel.toUpperCase();
  throw new Error(`Unsupported test selector: ${selector}`);
}

function walk(node, selector, firstOnly) {
  const results = [];
  (function visit(n) {
    if (n !== node && matches(n, selector)) {
      results.push(n);
      if (firstOnly) return;
    }
    n.children.forEach((child) => visit(child));
  })(node);
  return firstOnly ? (results[0] || null) : results;
}

function makeElement(document, tag) {
  const el = {
    tagName: tag.toUpperCase(),
    attrs: {},
    children: [],
    parent: null,
    dataset: {},
    hidden: false,
    textContent: "",
    title: "",
    type: "",
    accept: "",
    files: null,
    _listeners: {},
    style: (() => {
      const props = {};
      return {
        _props: props,
        setProperty(name, value) { props[name] = value; },
        removeProperty(name) { delete props[name]; },
        get backgroundImage() { return props["background-image"] || ""; },
        set backgroundImage(value) { props["background-image"] = value; }
      };
    })(),
    classList: {
      _set: new Set(),
      add(...names) { names.forEach((name) => this._set.add(name)); },
      remove(...names) { names.forEach((name) => this._set.delete(name)); },
      contains(name) { return this._set.has(name); }
    }
  };

  function setClasses(value) {
    el.classList._set = new Set(String(value).split(/\s+/).filter(Boolean));
    el.attrs.class = String(value);
  }

  Object.defineProperties(el, {
    className: {
      get() { return [...el.classList._set].join(" "); },
      set(value) { setClasses(value); }
    },
    id: {
      get() { return el.attrs.id || ""; },
      set(value) { el.attrs.id = String(value); document._byId.set(String(value), el); }
    },
    innerHTML: {
      get() { return ""; },
      set() {}
    }
  });

  el.setAttribute = (name, value) => {
    const v = String(value);
    el.attrs[name] = v;
    if (name === "class") setClasses(v);
    if (name === "id") document._byId.set(v, el);
  };
  el.getAttribute = (name) => (el.attrs[name] !== undefined ? el.attrs[name] : null);
  el.addEventListener = (type, handler) => { el._listeners[type] = handler; };
  el.appendChild = (child) => { child.parent = el; el.children.push(child); return child; };
  el.append = (...children) => { children.forEach((child) => el.appendChild(child)); };
  el.remove = () => {
    if (el.parent) {
      const index = el.parent.children.indexOf(el);
      if (index >= 0) el.parent.children.splice(index, 1);
      el.parent = null;
    }
  };
  el.click = () => { const handler = el._listeners.click; if (handler) handler({ target: el }); };
  el.querySelector = (selector) => walk(el, selector, true);
  el.querySelectorAll = (selector) => walk(el, selector, false);
  el.closest = (selector) => {
    let node = el;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parent;
    }
    return null;
  };

  if (tag === "input") document._inputs.push(el);
  if (tag === "canvas") {
    el.getContext = () => ({ drawImage() {} });
    el.toDataURL = () => "data:image/jpeg;base64,TEST";
  }
  return el;
}

function makeDocument({ withBody = true } = {}) {
  const document = { head: null, body: null, _byId: new Map(), _inputs: [], _listeners: {} };
  document.head = makeElement(document, "head");
  document.createBody = () => {
    if (!document.body) document.body = makeElement(document, "body");
    return document.body;
  };
  if (withBody) document.createBody();
  document.createElement = (tag) => makeElement(document, tag);
  document.getElementById = (id) => document._byId.get(id) || null;
  document.querySelectorAll = (selector) => document.body ? walk(document.body, selector, false) : [];
  document.addEventListener = (type, handler) => { document._listeners[type] = handler; };
  document.dispatchEvent = (type) => { if (document._listeners[type]) document._listeners[type](); };
  return document;
}

function makeChrome(initialStore, options = {}) {
  const state = { stored: initialStore, failSet: options.failSet || false, lastError: null };
  const listeners = [];
  const chrome = {
    runtime: {
      get lastError() { return state.lastError; },
      set lastError(value) { state.lastError = value; }
    },
    storage: {
      local: {
        get(defaults, callback) { callback({ ...defaults, ...state.stored }); },
        set(patch, callback) {
          if (state.failSet) {
            state.lastError = { message: "quota exceeded" };
            if (callback) callback();
            state.lastError = null;
            return;
          }
          Object.assign(state.stored, patch);
          if (callback) callback();
        }
      },
      onChanged: { addListener(listener) { listeners.push(listener); } }
    }
  };
  return { chrome, listeners, state };
}

function loadCardImages(options = {}) {
  const { pathname = "/", origin = "https://canvas.example.edu", initialStore = {}, failSet = false, build = null, withBody = true } = options;
  const document = makeDocument({ withBody });
  if (build) build(document);
  const { chrome, listeners, state } = makeChrome({ [cardImages.STORAGE_KEY]: initialStore }, { failSet });
  const sandbox = {
    document,
    location: { pathname, origin },
    chrome,
    MutationObserver: class { observe() {} },
    createImageBitmap: async () => ({ width: 100, height: 50, close() {} }),
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(source, sandbox);
  return { document, chrome, listeners, get stored() { return state.stored; } };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function makeCard(document, { courseId, headerKind = "image", canvasBackground = "" }) {
  const card = document.createElement("article");
  card.setAttribute("class", "ic-DashboardCard");
  const header = document.createElement("div");
  header.setAttribute("class", "ic-DashboardCard__header");
  const surface = document.createElement("div");
  surface.setAttribute("class", headerKind === "hero" ? "ic-DashboardCard__header_hero" : "ic-DashboardCard__header_image");
  if (canvasBackground) surface.style.backgroundImage = canvasBackground;
  const link = document.createElement("a");
  link.setAttribute("href", `/courses/${courseId}`);
  header.append(surface, link);
  card.appendChild(header);
  document.body.appendChild(card);
  return { card, header, surface };
}

function click(actions, button) {
  actions._listeners.click({
    target: button,
    preventDefault() {},
    stopPropagation() {}
  });
}

function pickFile(document) {
  const input = document._inputs[0];
  assert.ok(input, "file input should have been created");
  input.files = [{}];
  input._listeners.change();
  return input;
}

test("applies stored images to matching cards and leaves others untouched", async () => {
  let cards;
  const { document } = loadCardImages({
    initialStore: { "https://canvas.example.edu": { "101": "data:image/jpeg;base64,OLD" } },
    build: (doc) => {
      cards = {
        withImage: makeCard(doc, { courseId: "101" }),
        withoutImage: makeCard(doc, { courseId: "202", headerKind: "hero" }),
        canvasOwnImage: makeCard(doc, { courseId: "203", canvasBackground: "url('https://school/course.jpg')" })
      };
    }
  });
  await flush();

  assert.equal(cards.withImage.surface.style.backgroundImage, 'url("data:image/jpeg;base64,OLD")');
  assert.equal(cards.withImage.surface.dataset.openCanvasImage, "101");
  assert.equal(cards.withoutImage.surface.style.backgroundImage, "");
  assert.equal(cards.withoutImage.surface.dataset.openCanvasImage, undefined);
  assert.equal(cards.canvasOwnImage.surface.style.backgroundImage, "url('https://school/course.jpg')");

  const withImageActions = cards.withImage.card.querySelector(".oc-card-image-actions");
  const withoutImageActions = cards.withoutImage.card.querySelector(".oc-card-image-actions");
  assert.equal(withImageActions.querySelector(".oc-card-image-remove").hidden, false);
  assert.equal(withoutImageActions.querySelector(".oc-card-image-remove").hidden, true);
});

test("sets a custom image through the file picker and persists it", async () => {
  let cards;
  const { document, stored } = loadCardImages({
    build: (doc) => { cards = { target: makeCard(doc, { courseId: "202", headerKind: "hero" }) }; }
  });
  await flush();

  const actions = cards.target.card.querySelector(".oc-card-image-actions");
  click(actions, actions.querySelector(".oc-card-image-set"));
  pickFile(document);
  await flush();

  assert.equal(stored.cardImages["https://canvas.example.edu"]["202"], "data:image/jpeg;base64,TEST");
  assert.equal(cards.target.surface.style.backgroundImage, 'url("data:image/jpeg;base64,TEST")');
  assert.equal(actions.querySelector(".oc-card-image-remove").hidden, false);
});

test("replaces an existing custom image on the same card", async () => {
  let cards;
  const { document, stored } = loadCardImages({
    initialStore: { "https://canvas.example.edu": { "101": "data:image/jpeg;base64,OLD" } },
    build: (doc) => { cards = { target: makeCard(doc, { courseId: "101" }) }; }
  });
  await flush();
  assert.equal(cards.target.surface.style.backgroundImage, 'url("data:image/jpeg;base64,OLD")');

  const actions = cards.target.card.querySelector(".oc-card-image-actions");
  click(actions, actions.querySelector(".oc-card-image-set"));
  pickFile(document);
  await flush();

  assert.equal(stored.cardImages["https://canvas.example.edu"]["101"], "data:image/jpeg;base64,TEST");
  assert.equal(cards.target.surface.style.backgroundImage, 'url("data:image/jpeg;base64,TEST")');
});

test("removes a custom image and restores the card", async () => {
  let cards;
  const { document, stored } = loadCardImages({
    initialStore: { "https://canvas.example.edu": { "101": "data:image/jpeg;base64,OLD" } },
    build: (doc) => { cards = { target: makeCard(doc, { courseId: "101" }) }; }
  });
  await flush();

  const actions = cards.target.card.querySelector(".oc-card-image-actions");
  click(actions, actions.querySelector(".oc-card-image-remove"));

  assert.equal(JSON.stringify(stored.cardImages), "{}");
  assert.equal(cards.target.surface.style.backgroundImage, "");
  assert.equal(cards.target.surface.dataset.openCanvasImage, undefined);
  assert.equal(actions.querySelector(".oc-card-image-remove").hidden, true);
});

test("rolls back the card and shows a toast when the storage write fails", async () => {
  let cards;
  const { document, stored } = loadCardImages({
    failSet: true,
    build: (doc) => { cards = { target: makeCard(doc, { courseId: "202", headerKind: "hero" }) }; }
  });
  await flush();

  const actions = cards.target.card.querySelector(".oc-card-image-actions");
  click(actions, actions.querySelector(".oc-card-image-set"));
  pickFile(document);
  await flush();

  assert.deepEqual(stored.cardImages, {});
  assert.equal(cards.target.surface.style.backgroundImage, "");
  const toast = document.getElementById("opencanvas-card-image-toast");
  assert.match(toast.textContent, /quota/);
});

test("does nothing on non-dashboard pages", () => {
  let cards;
  const { document } = loadCardImages({
    pathname: "/courses/101",
    initialStore: { "https://canvas.example.edu": { "101": "data:image/jpeg;base64,OLD" } },
    build: (doc) => { cards = { target: makeCard(doc, { courseId: "101" }) }; }
  });

  assert.equal(cards.target.surface.style.backgroundImage, "");
  assert.equal(cards.target.card.querySelector(".oc-card-image-actions"), null);
});

test("waits for the body when injected at document_start", async () => {
  const { document } = loadCardImages({
    withBody: false,
    initialStore: { "https://canvas.example.edu": { "101": "data:image/jpeg;base64,OLD" } }
  });
  document.createBody();
  const card = makeCard(document, { courseId: "101" });
  document.dispatchEvent("DOMContentLoaded");
  await flush();

  assert.equal(card.surface.style.backgroundImage, 'url("data:image/jpeg;base64,OLD")');
  assert.ok(card.card.querySelector(".oc-card-image-actions"));
});

test("live-updates cards when another tab changes stored images", async () => {
  let cards;
  const { listeners, document } = loadCardImages({
    build: (doc) => { cards = { target: makeCard(doc, { courseId: "202", headerKind: "hero" }) }; }
  });
  await flush();

  const origin = "https://canvas.example.edu";
  listeners[0]({ cardImages: { newValue: { [origin]: { "202": "data:image/jpeg;base64,NEW" } } } }, "local");
  assert.equal(cards.target.surface.style.backgroundImage, 'url("data:image/jpeg;base64,NEW")');

  listeners[0]({ cardImages: { newValue: { [origin]: { "202": "data:image/jpeg;base64,NEW" } } } }, "sync");
  assert.equal(cards.target.surface.style.backgroundImage, 'url("data:image/jpeg;base64,NEW")');

  listeners[0]({ cardImages: { newValue: {} } }, "local");
  assert.equal(cards.target.surface.style.backgroundImage, "");
});
