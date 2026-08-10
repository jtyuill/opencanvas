(function initializeCardImages(root) {
  "use strict";

  const STORAGE_KEY = "cardImages";
  const MAX_DIMENSION = 1200;
  const JPEG_QUALITY = 0.82;
  const CARD_SELECTOR = ".ic-DashboardCard";
  const HEADER_SELECTOR = ".ic-DashboardCard__header";
  const COURSE_LINK_SELECTOR = 'a[href*="/courses/"]';

  function courseIdFromHref(href) {
    if (typeof href !== "string") return "";
    const match = href.match(/\/courses\/(\d+)/);
    return match ? match[1] : "";
  }

  function upsertImage(store, origin, courseId, dataUrl) {
    const next = { ...store };
    next[origin] = { ...(next[origin] || {}), [courseId]: dataUrl };
    return next;
  }

  function removeImage(store, origin, courseId) {
    const courses = store[origin];
    if (!courses || !courses[courseId]) return store;
    const next = { ...store };
    const rest = {};
    Object.keys(courses).forEach((id) => { if (id !== courseId) rest[id] = courses[id]; });
    if (Object.keys(rest).length === 0) delete next[origin];
    else next[origin] = rest;
    return next;
  }

  // Prefer the element Canvas itself paints the course image on, so the custom
  // image sits at the same stacking position as the school-provided one.
  function imageTargetForCard(card) {
    return card.querySelector(".ic-DashboardCard__header_image")
      || card.querySelector(".ic-DashboardCard__header_hero")
      || card.querySelector(HEADER_SELECTOR);
  }

  function cardCourseId(card) {
    const link = card.querySelector(COURSE_LINK_SELECTOR);
    return link ? courseIdFromHref(link.getAttribute("href")) : "";
  }

  const api = Object.freeze({
    STORAGE_KEY,
    courseIdFromHref,
    upsertImage,
    removeImage,
    imageTargetForCard,
    cardCourseId
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // --- Page-scoped behavior (skipped when loaded under Node for tests) ---
  if (!root.document || !root.location || root.location.pathname !== "/") return;

  const document = root.document;
  const chrome = root.chrome;
  const location = root.location;
  const origin = location.origin;

  let store = {};
  let scanTimer = null;
  let toastTimer = null;
  let started = false;

  function imageForCourse(courseId) {
    const byOrigin = store[origin];
    return byOrigin ? byOrigin[courseId] : "";
  }

  function loadStore(callback) {
    chrome.storage.local.get({ [STORAGE_KEY]: {} }, (value) => {
      store = (!chrome.runtime.lastError && value && value[STORAGE_KEY]) || {};
      callback();
    });
  }

  function persistStore(rollback, message) {
    chrome.storage.local.set({ [STORAGE_KEY]: store }, () => {
      if (!chrome.runtime.lastError) return;
      store = rollback(store);
      applyToAllCards();
      showToast(message);
    });
  }

  function applyCardImage(card, courseId) {
    const dataUrl = imageForCourse(courseId);
    const target = imageTargetForCard(card);
    if (!target || !dataUrl) return;
    if (target.dataset.openCanvasImage === courseId && target.dataset.openCanvasImageUrl === dataUrl) return;
    if (target.dataset.openCanvasImage === undefined) {
      target.dataset.openCanvasOriginalBackground = target.style.backgroundImage || "";
    }
    target.style.backgroundImage = `url("${dataUrl}")`;
    target.style.backgroundSize = "cover";
    target.style.backgroundPosition = "center";
    target.dataset.openCanvasImage = courseId;
    target.dataset.openCanvasImageUrl = dataUrl;
  }

  function clearCardImage(card) {
    const target = imageTargetForCard(card);
    if (!target || target.dataset.openCanvasImage === undefined) return;
    const original = target.dataset.openCanvasOriginalBackground;
    if (original) target.style.backgroundImage = original;
    else target.style.removeProperty("background-image");
    target.style.removeProperty("background-size");
    target.style.removeProperty("background-position");
    delete target.dataset.openCanvasImage;
    delete target.dataset.openCanvasImageUrl;
    delete target.dataset.openCanvasOriginalBackground;
  }

  function syncActionButtons(card, courseId) {
    let actions = card.querySelector(".oc-card-image-actions");
    if (!actions) {
      const header = card.querySelector(HEADER_SELECTOR) || card;
      actions = document.createElement("div");
      actions.className = "oc-card-image-actions";
      const setButton = document.createElement("button");
      setButton.type = "button";
      setButton.className = "oc-card-image-btn oc-card-image-set";
      setButton.title = "Set custom image for this course";
      setButton.setAttribute("aria-label", "Set custom image for this course");
      setButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "oc-card-image-btn oc-card-image-remove";
      removeButton.title = "Remove custom image";
      removeButton.setAttribute("aria-label", "Remove custom image");
      removeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      actions.append(setButton, removeButton);
      actions.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const button = event.target.closest("button");
        if (!button) return;
        if (button.classList.contains("oc-card-image-set")) openFilePicker(courseId);
        else if (button.classList.contains("oc-card-image-remove")) removeCourseImage(courseId);
      });
      header.appendChild(actions);
    }
    const removeButton = actions.querySelector(".oc-card-image-remove");
    if (removeButton) removeButton.hidden = !imageForCourse(courseId);
  }

  function applyToAllCards() {
    const cards = document.querySelectorAll(CARD_SELECTOR);
    cards.forEach((card) => {
      const courseId = cardCourseId(card);
      if (!courseId) return;
      if (imageForCourse(courseId)) {
        applyCardImage(card, courseId);
      } else {
        clearCardImage(card);
      }
      syncActionButtons(card, courseId);
    });
  }

  function setCourseImage(courseId, dataUrl) {
    const previous = imageForCourse(courseId);
    store = upsertImage(store, origin, courseId, dataUrl);
    applyToAllCards();
    persistStore((current) => {
      const without = removeImage(current, origin, courseId);
      return previous ? upsertImage(without, origin, courseId, previous) : without;
    }, "Could not save the image. Your storage quota may be full.");
  }

  function removeCourseImage(courseId) {
    const previous = imageForCourse(courseId);
    if (!previous) return;
    store = removeImage(store, origin, courseId);
    applyToAllCards();
    persistStore((current) => upsertImage(current, origin, courseId, previous),
      "Could not save the change. Your storage quota may be full.");
  }

  async function processFile(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }

  function openFilePicker(courseId) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      processFile(file)
        .then((dataUrl) => setCourseImage(courseId, dataUrl))
        .catch(() => showToast("Could not read that image file."));
    });
    input.click();
  }

  function showToast(message) {
    let toast = document.getElementById("opencanvas-card-image-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "opencanvas-card-image-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("oc-card-image-toast-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("oc-card-image-toast-visible"), 3000);
  }

  function observeCards() {
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(applyToAllCards, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    // This content script runs at document_start, before Canvas has created a
    // body on many navigations. Wait for one rather than throwing and leaving
    // the dashboard uninitialized.
    if (started || !document.body) return;
    started = true;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]) return;
      store = changes[STORAGE_KEY].newValue || {};
      applyToAllCards();
    });
    observeCards();
    loadStore(applyToAllCards);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})(globalThis);
