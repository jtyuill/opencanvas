"use strict";

if (typeof OpenCanvasSite === "undefined" && typeof importScripts === "function") {
  importScripts("site.js");
}

const CONTENT_SCRIPT_ID = "opencanvas-theme";
const CONTENT_SCRIPT_FILES = ["src/palette.js", "src/inline-color.js", "src/content.js", "src/card-images.js", "src/assignment-export.js"];
const CONTENT_STYLE_FILES = ["src/theme.css"];

async function currentRegistration() {
  const registrations = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  return registrations[0] || null;
}

async function unregisterTheme() {
  const registration = await currentRegistration();
  if (registration) await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
}

async function registerTheme(baseUrl) {
  const pattern = OpenCanvasSite.originPattern(baseUrl);
  const existing = await currentRegistration();
  const permitted = pattern && await chrome.permissions.contains({ origins: [pattern] });
  if (existing && permitted && existing.matches.length === 1 && existing.matches[0] === pattern) return true;
  if (existing) await unregisterTheme();
  if (!permitted) return false;

  await chrome.scripting.registerContentScripts([{
    id: CONTENT_SCRIPT_ID,
    matches: [pattern],
    css: CONTENT_STYLE_FILES,
    js: CONTENT_SCRIPT_FILES,
    runAt: "document_start",
    allFrames: true,
    matchOriginAsFallback: true,
    persistAcrossSessions: true
  }]);
  return true;
}

async function reloadMatchingTabs(pattern) {
  const tabs = await chrome.tabs.query({ url: pattern });
  await Promise.all(tabs.filter((tab) => tab.id).map((tab) => chrome.tabs.reload(tab.id)));
}

async function configureSchool(candidate) {
  const baseUrl = OpenCanvasSite.normalizeBaseUrl(candidate);
  if (!baseUrl) throw new Error("Enter a valid HTTPS Canvas URL.");
  const pattern = OpenCanvasSite.originPattern(baseUrl);
  if (!await chrome.permissions.contains({ origins: [pattern] })) {
    throw new Error("Site access was not granted.");
  }

  const stored = await chrome.storage.sync.get({ schoolBaseUrl: "" });
  const previousBaseUrl = OpenCanvasSite.normalizeBaseUrl(stored.schoolBaseUrl);
  const previousPattern = OpenCanvasSite.originPattern(previousBaseUrl);
  await registerTheme(baseUrl);
  await chrome.storage.sync.set({ schoolBaseUrl: baseUrl });

  if (previousPattern && previousPattern !== pattern) {
    await chrome.permissions.remove({ origins: [previousPattern] });
  }
  await reloadMatchingTabs(pattern);
  return { baseUrl };
}

async function syncRegistration() {
  const stored = await chrome.storage.sync.get({ schoolBaseUrl: "" });
  await registerTheme(stored.schoolBaseUrl);
}

chrome.runtime.onInstalled.addListener(() => { syncRegistration(); });
chrome.runtime.onStartup.addListener(() => { syncRegistration(); });
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.schoolBaseUrl) syncRegistration();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "opencanvas:set-school") return false;
  configureSchool(message.baseUrl)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { registerTheme, configureSchool };
}
