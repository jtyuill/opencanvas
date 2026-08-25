const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const assignmentExport = require("../src/assignment-export.js");
const source = fs.readFileSync(path.join(__dirname, "../src/assignment-export.js"), "utf8");

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

// --- Mini DOM ---------------------------------------------------------------

function text(value) {
  return { nodeType: TEXT_NODE, textContent: String(value), parentNode: null };
}

function el(tag, attrs, ...children) {
  const node = {
    nodeType: ELEMENT_NODE,
    tagName: String(tag).toUpperCase(),
    _attrs: {},
    _classes: new Set(),
    _childNodes: [],
    _listeners: {},
    style: {},
    parentNode: null
  };
  Object.defineProperty(node, "childNodes", { get: () => node._childNodes });
  Object.defineProperty(node, "children", {
    get: () => node._childNodes.filter((child) => child.nodeType === ELEMENT_NODE)
  });
  Object.defineProperty(node, "textContent", {
    get() { return node._childNodes.map((child) => child.textContent).join(""); },
    set(value) { node._childNodes = [text(String(value))]; }
  });
  Object.defineProperty(node, "className", {
    get() { return [...node._classes].join(" "); },
    set(value) {
      const parts = String(value).split(/\s+/).filter(Boolean);
      node._classes = new Set(parts);
      node._attrs.class = parts.join(" ");
    }
  });
  node.getAttribute = (name) => (node._attrs[name] !== undefined ? node._attrs[name] : null);
  node.setAttribute = (name, value) => {
    const v = String(value);
    node._attrs[name] = v;
    if (name === "class") node._classes = new Set(v.split(/\s+/).filter(Boolean));
  };
  node.appendChild = (child) => { child.parentNode = node; node._childNodes.push(child); return child; };
  node.append = (...childrenToAppend) => childrenToAppend.forEach((child) => node.appendChild(child));
  node.addEventListener = (type, handler) => { node._listeners[type] = handler; };
  node.click = () => {
    const handler = node._listeners.click;
    if (handler) handler({ target: node });
  };
  node.remove = () => {
    if (node.parentNode) {
      const index = node.parentNode._childNodes.indexOf(node);
      if (index >= 0) node.parentNode._childNodes.splice(index, 1);
      node.parentNode = null;
    }
  };
  node.querySelector = (selector) => querySelectorAll(node, selector)[0] || null;
  node.querySelectorAll = (selector) => querySelectorAll(node, selector);
  if (attrs) Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  for (const child of children) node.appendChild(typeof child === "string" ? text(child) : child);
  return node;
}

function matchesCompound(node, part) {
  if (node.nodeType !== ELEMENT_NODE) return false;
  let rest = part.trim();
  const tag = rest.match(/^[a-zA-Z][\w-]*/);
  if (tag) {
    if (node.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
    rest = rest.slice(tag[0].length);
  }
  let m;
  if ((m = rest.match(/^#([\w-]+)/))) {
    if (node._attrs.id !== m[1]) return false;
    rest = rest.slice(m[0].length);
  }
  while ((m = rest.match(/^\.([\w-]+)/))) {
    if (!node._classes.has(m[1])) return false;
    rest = rest.slice(m[0].length);
  }
  const attrPattern = /^\[([\w-]+)(?:([*^$])?=["']?([^\]"']*)["']?)?\]/;
  while ((m = rest.match(attrPattern))) {
    const name = m[1];
    const op = m[2] || "";
    const hasValue = m[3] !== undefined;
    const val = m[3] || "";
    const actual = node._attrs[name];
    if (actual === undefined) return false;
    if (op === "" && hasValue && actual !== val) return false;
    if (op === "*" && !String(actual).includes(val)) return false;
    if (op === "^" && !String(actual).startsWith(val)) return false;
    if (op === "$" && !String(actual).endsWith(val)) return false;
    rest = rest.slice(m[0].length);
  }
  return rest.trim() === "";
}

function collectDescendants(root, predicate) {
  const results = [];
  function visit(node) {
    if (node.nodeType === ELEMENT_NODE && node !== root && predicate(node)) results.push(node);
    const kids = node.children || [];
    for (const child of kids) visit(child);
  }
  visit(root);
  return results;
}

function querySelectorAll(root, selector) {
  const parts = selector.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  if (parts.length === 1) return collectDescendants(root, (node) => matchesCompound(node, parts[0]));
  if (parts.length === 2) {
    const results = [];
    for (const a of collectDescendants(root, (node) => matchesCompound(node, parts[0]))) {
      for (const b of collectDescendants(a, (node) => matchesCompound(node, parts[1]))) results.push(b);
    }
    return results;
  }
  throw new Error(`Unsupported test selector: ${selector}`);
}

function makeDoc() {
  const body = el("body");
  const doc = {
    body,
    createElement: (tag) => el(tag),
    createTextNode: (value) => text(value),
    querySelectorAll: (selector) => querySelectorAll(body, selector),
    querySelector: (selector) => querySelectorAll(body, selector)[0] || null,
    addEventListener: (type, handler) => { doc._listeners[type] = handler; },
    _listeners: {}
  };
  return doc;
}

function makeAssignmentPage() {
  const doc = makeDoc();
  const view = el("section", { "data-testid": "assignments-2-student-view" });
  const header = el("header", { "data-testid": "assignment-student-header" });
  header.append(
    el("span", { "data-testid": "title" }, "Homework 8"),
    el("span", { "data-testid": "assignment-sub-header" }, el("time", { "data-testid": "due-date" }, "Due tomorrow")),
    el("span", { "data-testid": "grade-display" }, "20/20 Points")
  );
  view.append(header);

  const description = el(
    "div",
    { "data-testid": "assignments-2-assignment-description", class: "user_content" },
    el("p", null, "Write a report on ", el("strong", null, "climate")),
    el("p", null, el("img", { src: "https://img.example.edu/chart.png", alt: "Chart" }))
  );
  view.append(description);

  const rubricWrap = el("div", { "data-testid": "rubric-assessment-traditional-view" });
  const rubricTable = el("table", { class: "assignment-rubric-table" });
  const thead = el("thead");
  thead.append(el("tr", null, el("td", null, "Criteria"), el("td", null, "Ratings"), el("td", null, "Points")));
  const tbody = el("tbody");
  tbody.append(el("tr", null, el("td", null, "Criterion"), el("td", null, "Selected"), el("td", null, "4/4 pts")));
  rubricTable.append(thead, tbody);
  rubricWrap.append(rubricTable);
  view.append(rubricWrap);

  const filesTable = el("table", { "data-testid": "uploaded_files_table" });
  filesTable.append(el("tbody", null,
    el("tr", null,
      el("td", null, "work.py"),
      el("td", { "data-testid": "file-size" }, "3 KB"),
      el("td", { "data-testid": "download-file" }, el("a", { href: "https://canvas.example.edu/courses/1/files/9/download" }, "Download"))
    )
  ));
  view.append(filesTable);
  doc.body.append(view);
  return doc;
}

// --- URL and filename helpers ----------------------------------------------

test("isAssignmentUrl matches assignment pages only", () => {
  assert.equal(assignmentExport.isAssignmentUrl("https://canvas.example.edu/courses/123/assignments/456"), true);
  assert.equal(assignmentExport.isAssignmentUrl("https://canvas.example.edu/courses/123/assignments/456?foo=bar"), true);
  assert.equal(assignmentExport.isAssignmentUrl("https://canvas.example.edu/courses/123/assignments/456/"), true);
  assert.equal(assignmentExport.isAssignmentUrl("https://canvas.example.edu/courses/123"), false);
  assert.equal(assignmentExport.isAssignmentUrl("https://canvas.example.edu/calendar"), false);
  assert.equal(assignmentExport.isAssignmentUrl("javascript:alert(1)"), false);
  assert.equal(assignmentExport.isAssignmentUrl(""), false);
});

test("sanitizeFilename strips illegal characters and trims", () => {
  assert.equal(assignmentExport.sanitizeFilename("Homework: 8? / \"Final\""), "Homework- 8- - -Final-");
  assert.equal(assignmentExport.sanitizeFilename("  My Assignment.  "), "My Assignment");
  assert.equal(assignmentExport.sanitizeFilename(""), "assignment");
  assert.equal(assignmentExport.sanitizeFilename("   "), "assignment");
});

// --- Markdown assembly ------------------------------------------------------

test("buildMarkdown renders title, metadata, description, rubric, and files", () => {
  const markdown = assignmentExport.buildMarkdown({
    title: "Homework 8",
    due: "Due tomorrow",
    points: "20/20 Points",
    status: "Anonymous Grading: no",
    descriptionMarkdown: "Assignment description",
    rubric: [["Criteria", "Ratings", "Points"], ["Criterion", "Selected", "4/4 pts"]],
    files: [{ name: "work.py", size: "3 KB", url: "https://canvas.example.edu/files/9/download" }]
  });
  assert.equal(markdown, [
    "# Homework 8",
    "",
    "**Due:** Due tomorrow",
    "**Points:** 20/20 Points",
    "**Status:** Anonymous Grading: no",
    "",
    "## Description",
    "",
    "Assignment description",
    "",
    "## Rubric",
    "",
    "| Criteria | Ratings | Points |",
    "| --- | --- | --- |",
    "| Criterion | Selected | 4/4 pts |",
    "",
    "## Files",
    "",
    "- [work.py](https://canvas.example.edu/files/9/download) — 3 KB",
    ""
  ].join("\n"));
});

test("buildMarkdown omits sections with no data", () => {
  const markdown = assignmentExport.buildMarkdown({ title: "Homework 8" });
  assert.equal(markdown, "# Homework 8\n");
});

// --- HTML to Markdown -------------------------------------------------------

async function convertNode(container, resolveImage) {
  return assignmentExport.convertHtmlToMarkdown(container, {
    resolveImage: resolveImage || (async (src) => src)
  });
}

test("convertHtmlToMarkdown handles inline formatting and lists", async () => {
  const container = el("div", null,
    el("h1", null, "Title"),
    el("p", null, "A ", el("strong", null, "bold"), " and ", el("em", null, "italic"), " word."),
    el("ul", null, el("li", null, "One"), el("li", null, "Two")),
    el("ol", null, el("li", null, "First"), el("li", null, "Second")),
    el("blockquote", null, el("p", null, "Quoted")),
    el("hr")
  );
  const markdown = await convertNode(container);
  assert.match(markdown, /# Title/);
  assert.match(markdown, /\*\*bold\*\* and \*italic\*/);
  assert.match(markdown, /- One\n- Two/);
  assert.match(markdown, /1\. First\n2\. Second/);
  assert.match(markdown, /> Quoted/);
  assert.match(markdown, /---/);
});

test("convertHtmlToMarkdown embeds images and links", async () => {
  const container = el("div", null,
    el("p", null, el("img", { src: "https://img.example.edu/chart.png", alt: "Chart" })),
    el("p", null, el("a", { href: "https://rubric.example.edu", }, "rubric"))
  );
  const resolved = asset =>
    asset === "https://img.example.edu/chart.png"
      ? "data:image/png;base64,iVBORw0KGgo="
      : asset;
  const markdown = await convertNode(container, async (src) => resolved(src));
  assert.equal(markdown, "![Chart](data:image/png;base64,iVBORw0KGgo=)\n\n[rubric](https://rubric.example.edu)");
});

test("convertHtmlToMarkdown renders tables", async () => {
  const table = el("table", null,
    el("thead", null, el("tr", null, el("th", null, "Criteria"), el("th", null, "Points"))),
    el("tbody", null, el("tr", null, el("td", null, "Quality"), el("td", null, "5 | 5")))
  );
  const markdown = await convertNode(el("div", null, table));
  assert.match(markdown, /\| Criteria \| Points \|/);
  assert.match(markdown, /\| --- \| --- \|/);
  assert.match(markdown, /\| Quality \| 5 \\\| 5 \|/);
});

test("convertHtmlToMarkdown falls back to a preview URL when an image cannot be embedded", async () => {
  const container = el("div", null, el("p", null, el("img", { src: "https://img.example.edu/offline.png" })));
  const markdown = await convertNode(container, async (src) => {
    throw new Error("network down");
  });
  assert.match(markdown, /\(https:\/\/img\.example\.edu\/offline\.png\)/);
});

test("exportAssignment drops images with unsafe schemes", async () => {
  const doc = makeDoc();
  const view = el("section", { "data-testid": "assignments-2-student-view" });
  const header = el("header", { "data-testid": "assignment-student-header" });
  header.append(el("span", { "data-testid": "title" }, "Homework 8"));
  view.append(header);
  const description = el("div", { "data-testid": "assignments-2-assignment-description", class: "user_content" },
    el("p", null, el("img", { src: "javascript:alert(1)", alt: "X" })));
  view.append(description);
  doc.body.append(view);

  const result = await assignmentExport.exportAssignment(
    doc,
    { href: "https://canvas.example.edu/courses/1/assignments/2" },
    async () => { throw new Error("should not fetch an unsafe image"); }
  );
  assert.doesNotMatch(result.markdown, /javascript:/);
});

// --- Extraction -------------------------------------------------------------

test("extractAssignment pulls title, due date, points, description, rubric, and files", () => {
  const data = assignmentExport.extractAssignment(makeAssignmentPage());
  assert.equal(data.title, "Homework 8");
  assert.equal(data.due, "Due tomorrow");
  assert.equal(data.points, "20/20 Points");
  assert.ok(data.descriptionNode);
  assert.deepEqual(data.rubric, [
    ["Criteria", "Ratings", "Points"],
    ["Criterion", "Selected", "4/4 pts"]
  ]);
  assert.deepEqual(data.files, [{
    name: "work.py",
    size: "3 KB",
    url: "https://canvas.example.edu/courses/1/files/9/download"
  }]);
});

// --- End-to-end export ------------------------------------------------------

function imageFetch() {
  return async (url) => {
    assert.equal(url, "https://img.example.edu/chart.png");
    return {
      ok: true,
      blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })
    };
  };
}

test("exportAssignment produces a Markdown file with embedded image data", async () => {
  const result = await assignmentExport.exportAssignment(
    makeAssignmentPage(),
    { href: "https://canvas.example.edu/courses/123/assignments/456" },
    imageFetch()
  );
  assert.equal(result.filename, "Homework 8.md");
  assert.match(result.markdown, /^# Homework 8/m);
  assert.match(result.markdown, /Write a report on \*\*climate\*\*/);
  assert.match(result.markdown, /data:image\/png;base64,/);
  assert.match(result.markdown, /\| Criterion \| Selected \| 4\/4 pts \|/);
  assert.match(result.markdown, /- \[work\.py\]\(https:\/\/canvas\.example\.edu\/courses\/1\/files\/9\/download\) — 3 KB/);
});

test("exportAssignment rejects non-assignment pages", async () => {
  await assert.rejects(
    () => assignmentExport.exportAssignment(makeAssignmentPage(), { href: "https://canvas.example.edu/calendar" }, imageFetch()),
    /Open a Canvas assignment page/
  );
});

// --- On-page export button --------------------------------------------------

class MockBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options && options.type;
  }
}

function sandbox({ href, doc, fetchImpl }) {
  const downloads = [];
  class MockURL extends URL {
    static createObjectURL(blob) {
      downloads.push(blob);
      return "blob:mock";
    }
    static revokeObjectURL() {}
  }
  const context = {
    module: { exports: {} },
    document: doc,
    location: { href },
    fetch: fetchImpl,
    URL: MockURL,
    Blob: MockBlob,
    Uint8Array,
    btoa,
    setTimeout
  };
  vm.runInNewContext(source, context);
  return { doc, downloads, exported: context.OpenCanvasAssignmentExport };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("mounts an export button on assignment pages", () => {
  const sandboxed = sandbox({ href: "https://canvas.example.edu/courses/1/assignments/2", doc: makeAssignmentPage(), fetchImpl: imageFetch() });
  const button = sandboxed.doc.querySelector(".opencanvas-export-button");
  assert.ok(button);
  assert.equal(button.textContent, "Export to Markdown");
  assert.equal(button.className, "opencanvas-export-button");
});

test("clicking the export button downloads the Markdown file", async () => {
  const sandboxed = sandbox({ href: "https://canvas.example.edu/courses/1/assignments/2", doc: makeAssignmentPage(), fetchImpl: imageFetch() });
  const button = sandboxed.doc.querySelector(".opencanvas-export-button");
  button.click();
  await flush();

  assert.equal(sandboxed.downloads.length, 1);
  assert.equal(sandboxed.downloads[0].type, "text/markdown");
  const markdown = sandboxed.downloads[0].parts[0];
  assert.match(markdown, /^# Homework 8/m);
  assert.match(markdown, /data:image\/png;base64,/);
  assert.match(markdown, /- \[work\.py\]\(https:\/\/canvas\.example\.edu\/courses\/1\/files\/9\/download\) — 3 KB/);
});

test("does not mount an export button off assignment pages", () => {
  const sandboxed = sandbox({ href: "https://canvas.example.edu/courses/1", doc: makeAssignmentPage(), fetchImpl: imageFetch() });
  assert.equal(sandboxed.doc.querySelector(".opencanvas-export-button"), null);
});
