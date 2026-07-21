const test = require("node:test");
const assert = require("node:assert/strict");
const site = require("../src/site.js");

test("normalizes school Canvas origins", () => {
  assert.equal(site.normalizeBaseUrl("canvas.example.edu/courses/1"), "https://canvas.example.edu");
  assert.equal(site.normalizeBaseUrl(" https://canvas.example.edu/path?query=1 "), "https://canvas.example.edu");
  assert.equal(site.originPattern("canvas.example.edu"), "https://canvas.example.edu/*");
});

test("rejects unsafe or malformed school URLs", () => {
  assert.equal(site.normalizeBaseUrl(""), "");
  assert.equal(site.normalizeBaseUrl("http://canvas.example.edu"), "");
  assert.equal(site.normalizeBaseUrl("https://user:pass@canvas.example.edu"), "");
  assert.equal(site.normalizeBaseUrl("not a url"), "");
  assert.equal(site.originPattern("javascript:alert(1)"), "");
});
