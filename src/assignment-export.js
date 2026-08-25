(function initializeAssignmentExport(root) {
  "use strict";

  const ELEMENT_NODE = 1;
  const TEXT_NODE = 3;
  const ASSIGNMENT_PATH_PATTERN = /^\/courses\/\d+\/assignments\/\d+/;
  const BUTTON_CLASS = "opencanvas-export-button";

  function isAssignmentUrl(url) {
    if (typeof url !== "string" || !url) return false;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
      return ASSIGNMENT_PATH_PATTERN.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  function cleanText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function escapeTableCell(value) {
    return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
  }

  function sanitizeFilename(value) {
    const name = cleanText(value)
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/[.\s]+$/g, "")
      .slice(0, 120);
    return (name || "assignment");
  }

  function elementChildren(node) {
    const result = [];
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType === ELEMENT_NODE) result.push(child);
    }
    return result;
  }

  async function convertNodes(nodes, ctx) {
    let output = "";
    for (let i = 0; i < nodes.length; i++) {
      output += await convertNode(nodes[i], ctx);
    }
    return output;
  }

  async function convertNode(node, ctx) {
    if (node.nodeType === TEXT_NODE) return node.textContent.replace(/\s+/g, " ");
    if (node.nodeType !== ELEMENT_NODE) return "";

    const tag = (node.tagName || "").toLowerCase();
    switch (tag) {
      case "img": {
        const src = node.getAttribute("src");
        const dataSrc = node.getAttribute("data-src");
        let resolved;
        try {
          resolved = await ctx.resolveImage(src, dataSrc);
        } catch {
          resolved = dataSrc || src || "";
        }
        if (!resolved) return "";
        const alt = cleanText(node.getAttribute("alt") || "");
        return `![${alt}](${resolved})`;
      }
      case "a": {
        const href = node.getAttribute("href");
        if (!href) return convertNodes(node.childNodes, ctx);
        const inner = cleanText(await convertNodes(node.childNodes, ctx));
        const title = cleanText(node.getAttribute("title") || "");
        const text = inner || title || href;
        return `[${text}](${href})`;
      }
      case "br":
        return "  \n";
      case "hr":
        return "\n\n---\n\n";
      case "strong":
      case "b":
        return `**${cleanText(await convertNodes(node.childNodes, ctx))}**`;
      case "em":
      case "i":
        return `*${cleanText(await convertNodes(node.childNodes, ctx))}*`;
      case "code":
        return `\`${node.textContent}\``;
      case "pre":
        return `\n\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
      case "blockquote": {
        const inner = cleanText(await convertNodes(node.childNodes, ctx));
        return inner ? `\n\n> ${inner}\n\n` : "";
      }
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
        const level = Number(tag[1]);
        const inner = cleanText(await convertNodes(node.childNodes, ctx));
        return inner ? `\n\n${"#".repeat(level)} ${inner}\n\n` : "";
      }
      case "p": {
        const inner = cleanText(await convertNodes(node.childNodes, ctx));
        return inner ? `\n\n${inner}\n\n` : "";
      }
      case "ul":
      case "ol": {
        const ordered = tag === "ol";
        const indent = "  ".repeat(ctx.listDepth || 0);
        const items = [];
        let index = 1;
        for (const child of elementChildren(node)) {
          if (child.tagName.toLowerCase() !== "li") continue;
          const body = cleanText(await convertNodes(child.childNodes, { ...ctx, listDepth: (ctx.listDepth || 0) + 1 }));
          if (!body) continue;
          const marker = ordered ? `${index++}.` : "-";
          items.push(`${indent}${marker} ${body}`);
        }
        return items.length ? `\n${items.join("\n")}\n` : "";
      }
      case "table": {
        const rows = [];
        for (const tr of rowElements(node)) {
          const cells = [];
          for (const cell of elementChildren(tr)) {
            const cellTag = cell.tagName.toLowerCase();
            if (cellTag !== "td" && cellTag !== "th") continue;
            cells.push(escapeTableCell(cleanText(await convertNodes(cell.childNodes, ctx))));
          }
          if (cells.length) rows.push(cells);
        }
        if (!rows.length) return "";
        const header = rows[0];
        const separator = header.map(() => "---");
        const body = rows.slice(1).map((row) => `| ${row.join(" | ")} |`).join("\n");
        return `\n\n| ${header.join(" | ")} |\n| ${separator.join(" | ")} |\n${body}\n\n`;
      }
      default:
        return convertNodes(node.childNodes, ctx);
    }
  }

  async function convertHtmlToMarkdown(container, options) {
    const ctx = { resolveImage: options.resolveImage, listDepth: options.listDepth || 0 };
    const output = await convertNodes(container.childNodes, ctx);
    return output.replace(/\n{3,}/g, "\n\n").trim();
  }

  function rowElements(tableNode) {
    const rows = [];
    function collect(node) {
      for (const child of elementChildren(node)) {
        const tag = (child.tagName || "").toLowerCase();
        if (tag === "tr") rows.push(child);
        else if (tag === "thead" || tag === "tbody" || tag === "tfoot") collect(child);
      }
    }
    collect(tableNode);
    return rows;
  }

  function rowTexts(row) {
    return elementChildren(row)
      .filter((cell) => {
        const tag = (cell.tagName || "").toLowerCase();
        return tag === "td" || tag === "th";
      })
      .map((cell) => cleanText(cell.textContent));
  }

  function firstText(document, selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) {
        const value = cleanText(node.textContent);
        if (value) return value;
      }
    }
    return "";
  }

  function extractFiles(document) {
    const files = [];
    const tableNode = document.querySelector('[data-testid="uploaded_files_table"]');
    if (!tableNode) return files;
    for (const row of rowElements(tableNode)) {
      const texts = rowTexts(row);
      if (!texts.length) continue;
      const name = texts[0] || "";
      const size = texts.length > 1 ? texts[1] : "";
      const link = row.querySelector("a[href]");
      files.push({ name, size, url: link ? link.getAttribute("href") : "" });
    }
    return files;
  }

  function extractRubric(document) {
    const tableNode = document.querySelector(
      '[data-testid="rubric-assessment-traditional-view"] table.assignment-rubric-table'
    ) || document.querySelector(".react-rubric table");
    if (!tableNode) return [];
    return rowElements(tableNode).map((row) => rowTexts(row));
  }

  function extractAssignment(document) {
    const title = firstText(document, [
      '[data-testid="assignments-2-student-view"] [data-testid="title"]',
      '[data-testid="title"]',
      "#assignment_show .title",
      "#assignment_show h1"
    ]);
    const due = firstText(document, [
      '[data-testid="assignments-2-student-view"] [data-testid="due-date"]',
      '[data-testid="due-date"]',
      '[data-testid="assignment-sub-header"]',
      "#assignment_show .due_date_display",
      "#assignment_show .due_date"
    ]);
    const points = firstText(document, [
      '[data-testid="assignments-2-student-view"] [data-testid="grade-display"]',
      '[data-testid="grade-display"]',
      "#assignment_show .points",
      "#assignment_show .assignment_points"
    ]);
    const status = firstText(document, [
      '[data-testid="assignment-student-anonymus-label"]',
      '[data-testid="submission-workflow-tracker"]'
    ]);
    const descriptionNode = document.querySelector('[data-testid="assignments-2-assignment-description"]')
      || document.querySelector("#assignment_show .user_content");

    return {
      title,
      due,
      points,
      status,
      descriptionNode,
      rubric: extractRubric(document),
      files: extractFiles(document)
    };
  }

  function rubricToMarkdown(rows) {
    const header = rows[0] || [];
    const line = `| ${header.join(" | ")} |`;
    const separator = `| ${header.map(() => "---").join(" | ")} |`;
    const body = rows.slice(1).map((row) => `| ${row.join(" | ")} |`).join("\n");
    return `${line}\n${separator}${body ? `\n${body}` : ""}`;
  }

  function buildMarkdown(data) {
    const chunks = [];
    const { title, due, points, status, descriptionMarkdown, rubric, files } = data;

    if (title) chunks.push(`# ${title}`);

    const meta = [];
    if (due) meta.push(`**Due:** ${due}`);
    if (points) meta.push(`**Points:** ${points}`);
    if (status) meta.push(`**Status:** ${status}`);
    if (meta.length) chunks.push(meta.join("\n"));

    if (descriptionMarkdown) chunks.push(`## Description\n\n${descriptionMarkdown}`);

    if (rubric && rubric.length) chunks.push(`## Rubric\n\n${rubricToMarkdown(rubric)}`);

    if (files && files.length) {
      const list = files.map((file) => {
        const label = file.name || file.url;
        const size = file.size ? ` — ${file.size}` : "";
        return file.url ? `- [${label}](${file.url})${size}` : `- ${label}${size}`;
      }).join("\n");
      chunks.push(`## Files\n\n${list}`);
    }

    return `${chunks.join("\n\n").trim()}\n`;
  }

  async function blobToDataUrl(blob) {
    if (typeof FileReader !== "undefined") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("Could not read image."));
        reader.readAsDataURL(blob);
      });
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
  }

  function safeImageUrl(value) {
    if (!value) return "";
    if (/^data:/i.test(value)) return value;
    if (/^https?:/i.test(value)) return value;
    return "";
  }

  function createImageResolver(fetchImpl, baseUrl) {
    return async function resolveImage(src, dataSrc) {
      const candidate = dataSrc || src || "";
      if (!candidate) return "";
      if (/^data:/i.test(candidate)) return candidate;
      const safe = safeImageUrl(candidate);
      if (!safe) {
        try {
          return safeImageUrl(new URL(candidate, baseUrl).href);
        } catch {
          return "";
        }
      }
      try {
        const response = await fetchImpl(safe, { credentials: "same-origin" });
        if (!response.ok) return safe;
        return await blobToDataUrl(await response.blob());
      } catch {
        return safe;
      }
    };
  }

  async function exportAssignment(document, location, fetchImpl) {
    if (!document || !location) throw new Error("No document available.");
    if (!isAssignmentUrl(location.href)) {
      throw new Error("Open a Canvas assignment page to export it.");
    }
    const data = extractAssignment(document);
    const descriptionMarkdown = data.descriptionNode
      ? await convertHtmlToMarkdown(data.descriptionNode, {
          resolveImage: createImageResolver(fetchImpl, location.href)
        })
      : "";
    const markdown = buildMarkdown({ ...data, descriptionMarkdown });
    const filename = `${sanitizeFilename(data.title || "assignment")}.md`;
    return { filename, markdown };
  }

  function downloadMarkdown(filename, contents, document) {
    const blob = new Blob([contents], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const BUTTON_STYLE = {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    background: "#1a1d21",
    color: "#f3f4f6",
    border: "1px solid #3b4149",
    borderRadius: "7px",
    padding: "8px 12px",
    font: "12px/1.4 system-ui, sans-serif",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.4)"
  };

  function injectExportButton(document, location, fetchImpl) {
    const host = document.body || document.documentElement;
    if (!host) return null;
    const existing = document.querySelector(`.${BUTTON_CLASS}`);
    if (existing) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "Export to Markdown";
    button.setAttribute("aria-label", "Export this assignment to Markdown");
    Object.assign(button.style, BUTTON_STYLE);
    button.addEventListener("click", () => {
      button.disabled = true;
      exportAssignment(document, location, fetchImpl)
        .then((result) => {
          downloadMarkdown(result.filename, result.markdown, document);
          button.textContent = "Export complete";
          setTimeout(() => { button.textContent = "Export to Markdown"; }, 2000);
        })
        .catch(() => {
          button.textContent = "Export failed";
          setTimeout(() => { button.textContent = "Export to Markdown"; }, 2000);
        })
        .finally(() => { button.disabled = false; });
    });
    host.appendChild(button);
    return button;
  }

  function start(document, location, fetchImpl) {
    if (document.body) {
      injectExportButton(document, location, fetchImpl);
      return;
    }
    document.addEventListener("DOMContentLoaded", () => {
      injectExportButton(document, location, fetchImpl);
    }, { once: true });
  }

  const api = Object.freeze({
    isAssignmentUrl,
    extractAssignment,
    extractFiles,
    extractRubric,
    convertHtmlToMarkdown,
    buildMarkdown,
    sanitizeFilename,
    exportAssignment,
    injectExportButton
  });
  root.OpenCanvasAssignmentExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // --- Page-scoped behavior (skipped when loaded under Node or outside Canvas) ---
  if (!root.document || !root.location || !isAssignmentUrl(root.location.href)) return;

  const document = root.document;
  const location = root.location;
  const fetchImpl = (root.fetch ? root.fetch.bind(root)
    : () => Promise.reject(new Error("fetch is unavailable.")));

  start(document, location, fetchImpl);
})(globalThis);
