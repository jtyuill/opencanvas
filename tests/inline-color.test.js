const test = require("node:test");
const assert = require("node:assert/strict");
const repair = require("../src/inline-color.js");

test("parses common computed CSS color formats", () => {
  assert.deepEqual(repair.parseColor("#abc"), { red: 170, green: 187, blue: 204, alpha: 1 });
  assert.deepEqual(repair.parseColor("rgb(10, 20, 30)"), { red: 10, green: 20, blue: 30, alpha: 1 });
  assert.deepEqual(repair.parseColor("rgb(10 20 30 / 50%)"), { red: 10, green: 20, blue: 30, alpha: 0.5 });
  assert.deepEqual(repair.parseColor("transparent"), { red: 0, green: 0, blue: 0, alpha: 0 });
  assert.equal(repair.parseColor("canvastext"), null);
});

test("composites alpha colors in visual order", () => {
  const result = repair.composite(
    { red: 255, green: 255, blue: 255, alpha: 0.5 },
    { red: 0, green: 0, blue: 0, alpha: 1 }
  );
  assert.deepEqual(result, { red: 127.5, green: 127.5, blue: 127.5, alpha: 1 });
});

test("repairs only unusable colors when replacement is accessible", () => {
  const black = repair.parseColor("#000000");
  const dark = repair.parseColor("#121212");
  const white = repair.parseColor("#ffffff");
  const light = repair.parseColor("#f5f5f5");

  assert.equal(repair.shouldRepair(black, dark, white), true);
  assert.equal(repair.shouldRepair(black, white, dark), false);
  assert.equal(repair.shouldRepair(light, dark, white), false);
  assert.ok(repair.contrastRatio(white, dark) >= 4.5);
});
