// CopyMark serializer: converts DOM to clean Markdown. Pure DOM + string
// work — no chrome.* APIs — so the same file runs injected into real pages
// and loaded directly in the test harness.
(() => {
  const DEFAULT_OPTS = {
    bullet: "-",
    fence: "```",
    imageMode: "markdown", // markdown | alt | skip
    gfmTables: false, // Pro
    pro: false
  };

  const BLOCK_TAGS = new Set(["P", "DIV", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "ASIDE", "NAV", "FIGURE", "FIGCAPTION", "ADDRESS", "DETAILS", "SUMMARY"]);
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "EMBED", "SVG", "CANVAS", "BUTTON", "SELECT", "TEXTAREA", "INPUT", "VIDEO", "AUDIO", "DIALOG"]);

  function collapse(text) {
    return text.replace(/\s+/g, " ");
  }

  function escapeText(text) {
    // Escape characters that would change meaning at line starts or inline.
    return text.replace(/([\\`*_[\]])/g, "\\$1").replace(/^([#>+-]|\d+\.)\s/gm, "\\$1 ");
  }

  function fenceLang(pre) {
    const code = pre.querySelector("code");
    const cls = ((code && code.className) || pre.className || "") + "";
    const m = cls.match(/(?:language|lang|brush|highlight-source)-([\w+-]+)/i);
    return m ? m[1].toLowerCase() : "";
  }

  function absUrl(url, doc) {
    if (!url) return "";
    try {
      return new URL(url, doc.baseURI).href;
    } catch {
      return url;
    }
  }

  // Renders inline content of a node into a single-line markdown string.
  function inline(node, opts, ctx) {
    let out = "";
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += escapeText(collapse(child.nodeValue));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName;
      if (SKIP_TAGS.has(tag)) continue;
      if (isHidden(child)) continue;

      if (tag === "BR") {
        out += "  \n";
      } else if (tag === "STRONG" || tag === "B") {
        const t = inline(child, opts, ctx).trim();
        if (t) out += `**${t}**`;
      } else if (tag === "EM" || tag === "I") {
        const t = inline(child, opts, ctx).trim();
        if (t) out += `*${t}*`;
      } else if (tag === "DEL" || tag === "S" || tag === "STRIKE") {
        const t = inline(child, opts, ctx).trim();
        if (t) out += `~~${t}~~`;
      } else if (tag === "CODE" || tag === "KBD" || tag === "SAMP") {
        const raw = collapse(child.textContent).trim();
        if (raw) out += raw.includes("`") ? `\`\` ${raw} \`\`` : `\`${raw}\``;
      } else if (tag === "A") {
        const href = child.getAttribute("href") || "";
        const t = inline(child, opts, ctx).trim() || collapse(child.textContent).trim();
        if (!href || href.startsWith("javascript:")) out += t;
        else if (t) out += `[${t}](${absUrl(href, child.ownerDocument)})`;
      } else if (tag === "IMG") {
        out += imageMd(child, opts);
      } else if (tag === "MARK") {
        out += `==${inline(child, opts, ctx).trim()}==`;
      } else if (tag === "SUB" || tag === "SUP") {
        out += inline(child, opts, ctx);
      } else {
        out += inline(child, opts, ctx);
      }
    }
    return out;
  }

  function imageMd(img, opts) {
    if (opts.imageMode === "skip") return "";
    const alt = collapse(img.getAttribute("alt") || "").trim();
    if (opts.imageMode === "alt") return alt ? `*${alt}*` : "";
    const src = absUrl(img.getAttribute("src") || "", img.ownerDocument);
    if (!src || src.startsWith("data:")) return alt ? `*${alt}*` : "";
    return `![${alt}](${src})`;
  }

  function isHidden(el) {
    // getComputedStyle is unavailable for detached fragments — treat as visible.
    const doc = el.ownerDocument;
    if (!doc || !doc.defaultView || !el.isConnected) return false;
    const cs = doc.defaultView.getComputedStyle(el);
    return cs.display === "none" || cs.visibility === "hidden";
  }

  function listMd(list, opts, indent) {
    const ordered = list.tagName === "OL";
    let n = parseInt(list.getAttribute("start") || "1", 10);
    if (Number.isNaN(n)) n = 1;
    let out = "";
    for (const li of list.children) {
      if (li.tagName !== "LI") continue;
      const marker = ordered ? `${n}.` : opts.bullet;
      n++;

      // task list?
      const box = li.querySelector(":scope > input[type=checkbox], :scope > p > input[type=checkbox], :scope > label > input[type=checkbox]");
      const task = box ? (box.checked ? "[x] " : "[ ] ") : "";

      // split into inline content + nested lists/blocks
      const liClone = li.cloneNode(true);
      for (const nested of liClone.querySelectorAll(":scope > ul, :scope > ol, :scope > pre, :scope > blockquote")) nested.remove();
      for (const cb of liClone.querySelectorAll("input[type=checkbox]")) cb.remove();
      const text = inline(liClone, opts, {}).trim();

      out += `${indent}${marker} ${task}${text}`.trimEnd() + "\n";
      for (const nested of li.children) {
        if (nested.tagName === "UL" || nested.tagName === "OL") {
          out += listMd(nested, opts, indent + (ordered ? "   " : "  "));
        } else if (nested.tagName === "PRE") {
          out += preMd(nested, opts).replace(/^/gm, indent + "  ") + "\n";
        } else if (nested.tagName === "BLOCKQUOTE") {
          out += blockquoteMd(nested, opts).replace(/^/gm, indent + "  ") + "\n";
        }
      }
    }
    return out;
  }

  function preMd(pre, opts) {
    const text = pre.textContent.replace(/\n$/, "");
    return `${opts.fence}${fenceLang(pre)}\n${text}\n${opts.fence}`;
  }

  function blockquoteMd(quote, opts) {
    const innerMd = blocks(quote, opts).trim();
    return innerMd
      .split("\n")
      .map((l) => (l ? `> ${l}` : ">"))
      .join("\n");
  }

  function cellText(cell, opts) {
    return inline(cell, opts, {}).trim().replace(/\|/g, "\\|").replace(/\n/g, " ");
  }

  function tableMd(table, opts) {
    if (!opts.gfmTables) {
      // Free tier: readable plain rows instead of GFM.
      const rows = [];
      for (const tr of table.querySelectorAll("tr")) {
        const cells = Array.from(tr.children)
          .filter((c) => c.tagName === "TD" || c.tagName === "TH")
          .map((c) => cellText(c, opts));
        if (cells.length) rows.push(cells.join(" — "));
      }
      return rows.join("\n");
    }
    const allRows = Array.from(table.querySelectorAll("tr")).filter((tr) => tr.querySelector("td, th"));
    if (!allRows.length) return "";
    const matrix = allRows.map((tr) =>
      Array.from(tr.children)
        .filter((c) => c.tagName === "TD" || c.tagName === "TH")
        .map((c) => cellText(c, opts))
    );
    const width = Math.max(...matrix.map((r) => r.length));
    for (const row of matrix) while (row.length < width) row.push("");
    const header = matrix[0];
    const body = matrix.slice(1);
    const line = (cells) => `| ${cells.join(" | ")} |`;
    const sep = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
    return [line(header), sep, ...body.map(line)].join("\n");
  }

  // Renders block-level content of `root` into markdown paragraphs.
  function blocks(root, opts) {
    let out = "";
    const push = (chunk) => {
      const c = (chunk || "").replace(/\s+$/, "");
      if (c) out += c + "\n\n";
    };

    for (const child of root.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = escapeText(collapse(child.nodeValue)).trim();
        if (t) push(t);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName;
      if (SKIP_TAGS.has(tag) || isHidden(child)) continue;

      if (/^H[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        push(`${"#".repeat(level)} ${inline(child, opts, {}).trim()}`);
      } else if (tag === "P") {
        push(inline(child, opts, {}).trim());
      } else if (tag === "UL" || tag === "OL") {
        push(listMd(child, opts, "").trimEnd());
      } else if (tag === "PRE") {
        push(preMd(child, opts));
      } else if (tag === "BLOCKQUOTE") {
        push(blockquoteMd(child, opts));
      } else if (tag === "TABLE") {
        push(tableMd(child, opts));
      } else if (tag === "HR") {
        push("---");
      } else if (tag === "IMG") {
        push(imageMd(child, opts));
      } else if (tag === "FIGURE") {
        const img = child.querySelector("img");
        const cap = child.querySelector("figcaption");
        const parts = [];
        if (img) parts.push(imageMd(img, opts));
        if (cap) parts.push(`*${inline(cap, opts, {}).trim()}*`);
        push(parts.filter(Boolean).join("\n"));
      } else if (BLOCK_TAGS.has(tag) || tag === "LI" || tag === "TR" || tag === "TBODY" || tag === "THEAD") {
        // container: recurse as block content
        const innerBlocks = blocks(child, opts);
        if (innerBlocks.trim()) out += innerBlocks;
      } else {
        // treat unknown elements as inline content in their own paragraph
        const t = inline(child, opts, {}).trim();
        if (t) push(t);
      }
    }
    return out;
  }

  function serialize(root, userOpts = {}) {
    const opts = { ...DEFAULT_OPTS, ...userOpts };
    if (!opts.pro) opts.gfmTables = false;
    return blocks(root, opts).replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  // Serializes the current selection (all ranges) of `doc`.
  function selectionToMarkdown(doc, userOpts = {}) {
    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return "";
    const container = doc.createElement("div");
    for (let i = 0; i < sel.rangeCount; i++) {
      container.appendChild(sel.getRangeAt(i).cloneContents());
    }
    // Selections starting mid-block produce loose text/inline nodes; blocks()
    // handles those as paragraphs.
    return serialize(container, userOpts);
  }

  function pageLink(doc) {
    const title = (doc.title || doc.location.href).trim().replace(/([\\`*_[\]])/g, "\\$1");
    return `[${title}](${doc.location.href})`;
  }

  globalThis.CopyMarkSerializer = {
    VERSION: "1.0.0",
    serialize,
    selectionToMarkdown,
    pageLink,
    tableMd,
    DEFAULT_OPTS
  };
})();
