const test = require("node:test");
const assert = require("node:assert/strict");
const palette = require("../src/palette.js");

test("normalizes malformed settings to safe defaults", () => {
  assert.deepEqual(palette.normalizeSettings({
    enabled: "yes",
    selectedPalette: "unknown",
    customPalette: { background: "red", accent: "#ABCDEF" }
  }), {
    enabled: true,
    selectedPalette: "vol-midnight",
    customPalette: {
      ...palette.DARK_PALETTE,
      accent: "#abcdef"
    }
  });
});

test("rejects inherited object properties as preset names", () => {
  assert.equal(palette.normalizeSettings({ selectedPalette: "toString" }).selectedPalette, "vol-midnight");
});

test("resolves custom palettes without changing the built-in palette", () => {
  const customPalette = { ...palette.DARK_PALETTE, background: "#121212" };
  const resolved = palette.resolvePalette({
    enabled: true,
    selectedPalette: "custom",
    customPalette
  });

  assert.equal(resolved.background, "#121212");
  assert.equal(palette.DARK_PALETTE.background, "#121212");
});

test("resolves every built-in preset", () => {
  Object.entries(palette.PRESET_PALETTES).forEach(([name, expected]) => {
    assert.deepEqual(palette.resolvePalette({ selectedPalette: name }), expected);
  });
});

test("built-in text and accent combinations meet WCAG AA", () => {
  Object.values(palette.PRESET_PALETTES).forEach((preset) => {
    const variables = palette.paletteToVariables(preset);
    assert.ok(palette.contrastRatio(preset.text, preset.background) >= 4.5);
    assert.ok(palette.contrastRatio(variables["--ct-accent-text"], preset.accent) >= 4.5);
  });
});

test("palette variables are complete CSS-safe hex colors", () => {
  const variables = palette.paletteToVariables(palette.DARK_PALETTE);
  assert.equal(Object.keys(variables).length, 16);
  Object.values(variables).forEach((value) => assert.match(value, /^#[0-9a-f]{6}$/));
});

test("palette audit checks text roles and focus visibility", () => {
  const audit = palette.auditPalette(palette.VOL_MIDNIGHT_PALETTE);
  assert.deepEqual(audit.map((check) => check.label), [
    "Body text",
    "Surface text",
    "Raised text",
    "Muted page text",
    "Muted surface text",
    "Muted raised text",
    "Page links",
    "Surface links",
    "Raised links",
    "Accent button text",
    "Focus indicator"
  ]);
  audit.forEach((check) => {
    assert.equal(check.passes, check.ratio >= check.threshold);
    assert.ok(check.threshold === 3 || check.threshold === 4.5);
  });
});
