(function initializeInlineColorRepair(root) {
  "use strict";

  const REPAIR_ATTRIBUTE = "data-ct-inline-color-repair";
  const RICH_CONTENT_SELECTOR = ".user_content";

  function clampChannel(value) {
    return Math.min(255, Math.max(0, value));
  }

  function parseColor(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };

    const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const expanded = hex[1].length === 3
        ? [...hex[1]].map((character) => character + character).join("")
        : hex[1];
      return {
        red: Number.parseInt(expanded.slice(0, 2), 16),
        green: Number.parseInt(expanded.slice(2, 4), 16),
        blue: Number.parseInt(expanded.slice(4, 6), 16),
        alpha: 1
      };
    }

    const functional = normalized.match(/^rgba?\((.*)\)$/);
    if (!functional) return null;
    const parts = functional[1].trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);
    if (parts.length !== 3 && parts.length !== 4) return null;

    function parseChannel(part) {
      const number = Number.parseFloat(part);
      if (!Number.isFinite(number)) return null;
      return part.endsWith("%") ? clampChannel(number * 255 / 100) : clampChannel(number);
    }

    const channels = parts.slice(0, 3).map(parseChannel);
    if (channels.includes(null)) return null;
    let alpha = 1;
    if (parts[3] !== undefined) {
      const amount = Number.parseFloat(parts[3]);
      if (!Number.isFinite(amount)) return null;
      alpha = Math.min(1, Math.max(0, parts[3].endsWith("%") ? amount / 100 : amount));
    }
    return { red: channels[0], green: channels[1], blue: channels[2], alpha };
  }

  function composite(foreground, background) {
    const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
    if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
    return {
      red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
      green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
      blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
      alpha
    };
  }

  function luminance(color) {
    const channels = [color.red, color.green, color.blue].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastRatio(first, second) {
    const firstLuminance = luminance(first);
    const secondLuminance = luminance(second);
    return (Math.max(firstLuminance, secondLuminance) + 0.05)
      / (Math.min(firstLuminance, secondLuminance) + 0.05);
  }

  function shouldRepair(foreground, background, replacement) {
    const visibleForeground = composite(foreground, background);
    const currentRatio = contrastRatio(visibleForeground, background);
    const replacementRatio = contrastRatio(composite(replacement, background), background);
    return currentRatio < 3 && replacementRatio >= 4.5 && replacementRatio > currentRatio;
  }

  function create(environment) {
    const document = environment.document;
    const getComputedStyle = environment.getComputedStyle;
    const Observer = environment.MutationObserver;
    const repaired = new Set();
    let observer = null;
    let theme = null;

    function removeRepair(element) {
      element.removeAttribute(REPAIR_ATTRIBUTE);
      repaired.delete(element);
    }

    function effectiveBackground(element) {
      const layers = [];
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if ((style.backgroundImage && style.backgroundImage !== "none")
          || (style.filter && style.filter !== "none")
          || (style.mixBlendMode && style.mixBlendMode !== "normal")
          || (style.opacity && Number.parseFloat(style.opacity) < 1)) return null;
        const color = parseColor(style.backgroundColor || "transparent");
        if (!color) return null;
        layers.push(color);
        if (color.alpha === 1) break;
      }

      let background = parseColor(theme.background);
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        background = composite(layers[index], background);
      }
      return background;
    }

    function evaluate(element) {
      const inlineColor = element.style && element.style.getPropertyValue("color");
      if (!inlineColor || element.style.getPropertyPriority("color") === "important") {
        removeRepair(element);
        return;
      }

      element.removeAttribute(REPAIR_ATTRIBUTE);
      const style = getComputedStyle(element);
      const foreground = parseColor(style.color);
      const background = effectiveBackground(element);
      const replacement = parseColor(theme.text);
      if (foreground && background && replacement && shouldRepair(foreground, background, replacement)) {
        element.setAttribute(REPAIR_ATTRIBUTE, "");
        repaired.add(element);
      } else {
        repaired.delete(element);
      }
    }

    function scan(node) {
      if (!node || node.nodeType !== 1) return;
      const roots = [];
      if (node.matches(RICH_CONTENT_SELECTOR)) roots.push(node);
      if (node.closest(RICH_CONTENT_SELECTOR)) roots.push(node);
      node.querySelectorAll(RICH_CONTENT_SELECTOR).forEach((richRoot) => roots.push(richRoot));

      new Set(roots).forEach((richRoot) => {
        if (richRoot.style && richRoot.style.getPropertyValue("color")) evaluate(richRoot);
        richRoot.querySelectorAll("[style]").forEach(evaluate);
      });
    }

    function handleMutations(mutations) {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") scan(mutation.target);
        mutation.addedNodes.forEach(scan);
      });
      repaired.forEach((element) => {
        if (!element.isConnected || !element.closest(RICH_CONTENT_SELECTOR)) removeRepair(element);
      });
    }

    function applyTheme(nextTheme) {
      theme = nextTheme;
      if (!theme) {
        repaired.forEach((element) => element.removeAttribute(REPAIR_ATTRIBUTE));
        repaired.clear();
        if (observer) observer.disconnect();
        observer = null;
        return;
      }

      document.querySelectorAll(RICH_CONTENT_SELECTOR).forEach(scan);
      if (!observer && Observer && document.documentElement) {
        observer = new Observer(handleMutations);
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["style", "class"]
        });
      }
    }

    return { applyTheme };
  }

  const api = Object.freeze({
    REPAIR_ATTRIBUTE,
    parseColor,
    composite,
    contrastRatio,
    shouldRepair,
    create
  });

  root.CanvasInlineColorRepair = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
