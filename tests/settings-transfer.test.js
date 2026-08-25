const test = require("node:test");
const assert = require("node:assert/strict");

const palette = require("../src/palette.js");
const transfer = require("../src/settings-transfer.js");

const settings = {
  enabled: false,
  selectedPalette: "custom",
  customPalette: {
    background: "#101010",
    surface: "#202020",
    surfaceRaised: "#303030",
    text: "#f0f0f0",
    muted: "#a0a0a0",
    border: "#606060",
    accent: "#80aaff"
  },
  schoolBaseUrl: "https://canvas.example.edu"
};

const images = {
  "https://canvas.example.edu": {
    "12": "https://images.example.edu/course-12.jpg",
    "34": "data:image/jpeg;base64,VEVTVA=="
  }
};

test("settings files round-trip theme settings, image links, and embedded images", () => {
  const serialized = transfer.serializeSettingsFile(settings, images);
  const parsed = transfer.parseSettingsFile(serialized);

  assert.deepEqual(parsed.settings, settings);
  assert.deepEqual(parsed.images, images);
  assert.match(serialized, /"format": "opencanvas-settings"/);
  assert.match(serialized, /data:image\/jpeg;base64,VEVTVA==/);
});

test("settings exports normalize existing values and discard invalid stored images", () => {
  const payload = transfer.createSettingsFile(
    { ...palette.DEFAULT_SETTINGS, customPalette: {} },
    {
      "https://canvas.example.edu/path": {
        "7": " https://images.example.edu/photo.png ",
        nope: "javascript:alert(1)"
      },
      invalid: { "8": "data:image/jpeg;base64,VEVTVA==" }
    }
  );

  assert.deepEqual(payload.settings.customPalette, palette.DARK_PALETTE);
  assert.deepEqual(payload.images, {
    "https://canvas.example.edu": { "7": "https://images.example.edu/photo.png" }
  });
});

test("settings imports reject unknown versions and invalid image sources", () => {
  const payload = transfer.createSettingsFile(settings, images);
  assert.throws(
    () => transfer.parseSettingsFile(JSON.stringify({ ...payload, version: 2 })),
    /version 2 is not supported/
  );
  assert.throws(
    () => transfer.parseSettingsFile(JSON.stringify({
      ...payload,
      images: { "https://canvas.example.edu": { "12": "javascript:alert(1)" } }
    })),
    /image for course 12 is invalid/
  );
});
