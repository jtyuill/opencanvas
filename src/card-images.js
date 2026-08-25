(function initializeCardImages(root) {
  "use strict";

  const STORAGE_KEY = "cardImages";
  const MAX_DIMENSION = 1200;
  const JPEG_QUALITY = 0.82;
  const CARD_SELECTOR = ".ic-DashboardCard";
  const HEADER_SELECTOR = ".ic-DashboardCard__header";
  const COURSE_LINK_SELECTOR = 'a[href*="/courses/"]';
  const BASE64_IMAGE_PATTERN = /^data:image\/(?:avif|gif|jpeg|png|webp);base64,(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i;

  function courseIdFromHref(href) {
    if (typeof href !== "string") return "";
    const match = href.match(/\/courses\/(\d+)/);
    return match ? match[1] : "";
  }
  function normalizeImageSource(value) {
    if (typeof value !== "string") return "";
    const candidate = value.trim();
    if (BASE64_IMAGE_PATTERN.test(candidate)) return candidate;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" || url.username || url.password) return "";
      return url.href;
    } catch {
      return "";
    }
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
    normalizeImageSource,
    upsertImage,
    removeImage,
    imageTargetForCard,
    cardCourseId
  });
  root.OpenCanvasCardImages = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // --- Page-scoped behavior (skipped when loaded under Node for tests) ---
  if (!root.document || !root.location || root.location.pathname !== "/") return;

  const document = root.document;
  const chrome = root.chrome;
  const location = root.location;
  const origin = location.origin;

  let store = {};
  const preloadedImageUrls = new Set();
  let toastTimer = null;
  let started = false;

  function imageForCourse(courseId) {
    const byOrigin = store[origin];
    return byOrigin ? byOrigin[courseId] : "";
  }
  function preloadRemoteImages() {
    if (!document.head) return;
    const courses = store[origin] || {};
    Object.values(courses).forEach((imageUrl) => {
      if (typeof imageUrl !== "string"
        || !imageUrl.startsWith("https://")
        || preloadedImageUrls.has(imageUrl)) return;
      const preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "image";
      preload.href = imageUrl;
      document.head.appendChild(preload);
      preloadedImageUrls.add(imageUrl);
    });
  }


  function loadStore(callback) {
    chrome.storage.local.get({ [STORAGE_KEY]: {} }, (value) => {
      store = (!chrome.runtime.lastError && value && value[STORAGE_KEY]) || {};
      preloadRemoteImages();
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
      setButton.title = "Upload custom image";
      setButton.setAttribute("aria-label", "Upload custom image for this course");
      setButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      const linkButton = document.createElement("button");
      linkButton.type = "button";
      linkButton.className = "oc-card-image-btn oc-card-image-link";
      linkButton.title = "Use image URL";
      linkButton.setAttribute("aria-label", "Set image from URL for this course");
      linkButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>';
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "oc-card-image-btn oc-card-image-remove";
      removeButton.title = "Remove custom image";
      removeButton.setAttribute("aria-label", "Remove custom image");
      removeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      actions.append(setButton, linkButton, removeButton);
      actions.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const button = event.target.closest("button");
        if (!button) return;
        if (button.classList.contains("oc-card-image-set")) openFilePicker(courseId);
        else if (button.classList.contains("oc-card-image-link")) openUrlPrompt(courseId);
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
    preloadRemoteImages();
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

  function openUrlPrompt(courseId) {
    if (typeof root.prompt !== "function") {
      showToast("Image URL entry is unavailable.");
      return;
    }
    const current = imageForCourse(courseId);
    const initialValue = current.startsWith("https://") ? current : "";
    const candidate = root.prompt("Enter an HTTPS image URL:", initialValue);
    if (candidate === null) return;
    const imageUrl = normalizeImageSource(candidate);
    if (!imageUrl || !imageUrl.startsWith("https://")) {
      showToast("Enter a valid HTTPS image URL.");
      return;
    }
    setCourseImage(courseId, imageUrl);
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
    const observer = new MutationObserver(applyToAllCards);
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
      preloadRemoteImages();
      applyToAllCards();
    });
    observeCards();
    loadStore(applyToAllCards);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})(globalThis);
