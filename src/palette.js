(function initializePaletteApi(root) {
  "use strict";

  const COLOR_KEYS = [
    "background",
    "surface",
    "surfaceRaised",
    "text",
    "muted",
    "border",
    "accent"
  ];

  const DARK_PALETTE = Object.freeze({
    background: "#121212",
    surface: "#1e1e1e",
    surfaceRaised: "#292929",
    text: "#f5f5f5",
    muted: "#b3b3b3",
    border: "#454545",
    accent: "#8ab4f8"
  });

  const MIDNIGHT_ORANGE_PALETTE = Object.freeze({
    background: "#0f1115",
    surface: "#171a21",
    surfaceRaised: "#20242d",
    text: "#edf0f5",
    muted: "#aeb6c2",
    border: "#3a414d",
    accent: "#ff9a3d"
  });

  const PRESET_PALETTES = Object.freeze({
    dark: DARK_PALETTE,
    "midnight-orange": MIDNIGHT_ORANGE_PALETTE,
    "tokyo-night": Object.freeze({
      background: "#1a1b26",
      surface: "#24283b",
      surfaceRaised: "#292e42",
      text: "#c0caf5",
      muted: "#9aa5ce",
      border: "#414868",
      accent: "#7aa2f7"
    }),
    dracula: Object.freeze({
      background: "#282a36",
      surface: "#343746",
      surfaceRaised: "#44475a",
      text: "#f8f8f2",
      muted: "#b9bac8",
      border: "#6272a4",
      accent: "#bd93f9"
    }),
    nord: Object.freeze({
      background: "#2e3440",
      surface: "#3b4252",
      surfaceRaised: "#434c5e",
      text: "#eceff4",
      muted: "#d8dee9",
      border: "#4c566a",
      accent: "#88c0d0"
    }),
    "gruvbox-dark": Object.freeze({
      background: "#282828",
      surface: "#32302f",
      surfaceRaised: "#3c3836",
      text: "#ebdbb2",
      muted: "#bdae93",
      border: "#665c54",
      accent: "#fabd2f"
    }),
    "solarized-dark": Object.freeze({
      background: "#002b36",
      surface: "#073642",
      surfaceRaised: "#0d4553",
      text: "#eee8d5",
      muted: "#93a1a1",
      border: "#586e75",
      accent: "#2aa198"
    })
  });

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    selectedPalette: "midnight-orange",
    customPalette: DARK_PALETTE,
    schoolBaseUrl: ""
  });

  function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function normalizePalette(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    return Object.fromEntries(
      COLOR_KEYS.map((key) => [key, isHexColor(source[key]) ? source[key].toLowerCase() : DARK_PALETTE[key]])
    );
  }

  function normalizeSettings(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const selectedPalette = source.selectedPalette === "custom"
      || Object.prototype.hasOwnProperty.call(PRESET_PALETTES, source.selectedPalette)
      ? source.selectedPalette
      : DEFAULT_SETTINGS.selectedPalette;
    return {
      enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SETTINGS.enabled,
      selectedPalette,
      customPalette: normalizePalette(source.customPalette),
      schoolBaseUrl: typeof source.schoolBaseUrl === "string" ? source.schoolBaseUrl : ""
    };
  }

  function hexToRgb(hex) {
    if (!isHexColor(hex)) return null;
    return {
      red: Number.parseInt(hex.slice(1, 3), 16),
      green: Number.parseInt(hex.slice(3, 5), 16),
      blue: Number.parseInt(hex.slice(5, 7), 16)
    };
  }

  function rgbToHex({ red, green, blue }) {
    return `#${[red, green, blue]
      .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function mixColors(first, second, weight) {
    const firstRgb = hexToRgb(first);
    const secondRgb = hexToRgb(second);
    const amount = Math.min(1, Math.max(0, weight));
    return rgbToHex({
      red: firstRgb.red * (1 - amount) + secondRgb.red * amount,
      green: firstRgb.green * (1 - amount) + secondRgb.green * amount,
      blue: firstRgb.blue * (1 - amount) + secondRgb.blue * amount
    });
  }

  function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const channels = [rgb.red, rgb.green, rgb.blue].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastRatio(first, second) {
    const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
    const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function contrastingText(background) {
    return contrastRatio(background, "#101318") >= contrastRatio(background, "#ffffff")
      ? "#101318"
      : "#ffffff";
  }

  function resolvePalette(settings) {
    const normalized = normalizeSettings(settings);
    return normalized.selectedPalette === "custom"
      ? normalized.customPalette
      : { ...PRESET_PALETTES[normalized.selectedPalette] };
  }

  function paletteToVariables(palette) {
    const colors = normalizePalette(palette);
    return {
      "--ct-background": colors.background,
      "--ct-surface": colors.surface,
      "--ct-surface-raised": colors.surfaceRaised,
      "--ct-text": colors.text,
      "--ct-muted": colors.muted,
      "--ct-border": colors.border,
      "--ct-accent": colors.accent,
      "--ct-accent-hover": mixColors(colors.accent, colors.text, 0.18),
      "--ct-accent-soft": mixColors(colors.accent, colors.background, 0.82),
      "--ct-accent-text": contrastingText(colors.accent),
      "--ct-danger": "#ff7b86",
      "--ct-danger-soft": mixColors("#ff7b86", colors.background, 0.84),
      "--ct-success": "#72d49b",
      "--ct-success-soft": mixColors("#72d49b", colors.background, 0.84),
      "--ct-warning": "#f4c56a",
      "--ct-warning-soft": mixColors("#f4c56a", colors.background, 0.84)
    };
  }

  function auditPalette(palette) {
    const colors = normalizePalette(palette);
    const variables = paletteToVariables(colors);
    const checks = [
      ["Body text", colors.text, colors.background, 4.5],
      ["Surface text", colors.text, colors.surface, 4.5],
      ["Raised text", colors.text, colors.surfaceRaised, 4.5],
      ["Muted page text", colors.muted, colors.background, 4.5],
      ["Muted surface text", colors.muted, colors.surface, 4.5],
      ["Muted raised text", colors.muted, colors.surfaceRaised, 4.5],
      ["Page links", colors.accent, colors.background, 4.5],
      ["Surface links", colors.accent, colors.surface, 4.5],
      ["Raised links", colors.accent, colors.surfaceRaised, 4.5],
      ["Accent button text", variables["--ct-accent-text"], colors.accent, 4.5],
      ["Focus indicator", colors.accent, colors.background, 3]
    ];
    return checks.map(([label, foreground, background, threshold]) => {
      const ratio = contrastRatio(foreground, background);
      return { label, foreground, background, threshold, ratio, passes: ratio >= threshold };
    });
  }

  const api = Object.freeze({
    COLOR_KEYS,
    DARK_PALETTE,
    MIDNIGHT_ORANGE_PALETTE,
    PRESET_PALETTES,
    DEFAULT_SETTINGS,
    isHexColor,
    normalizePalette,
    normalizeSettings,
    contrastRatio,
    resolvePalette,
    paletteToVariables,
    auditPalette
  });

  root.CanvasPalette = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
