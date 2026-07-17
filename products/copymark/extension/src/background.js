// CopyMark background: routes the keyboard command, context menus, and popup
// requests into one capture pipeline (serializer injected via scripting API).
importScripts("lib/config.js", "lib/ExtPay.js");

if (COPYMARK_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(COPYMARK_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

const DEFAULTS = {
  bullet: "-",
  imageMode: "markdown",
  fence: "```",
  frontMatter: "",
  pro: false
};

async function getSettings() {
  const { settings } = await chrome.storage.local.get({ settings: DEFAULTS });
  return { ...DEFAULTS, ...settings };
}

// Runs IN THE PAGE (stringified): serializer already injected. Builds the
// markdown for `action` and optionally writes it to the clipboard there.
function pageCapture(action, opts, writeInPage) {
  const S = globalThis.CopyMarkSerializer;

  function frontMatter(template, doc) {
    if (!template) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const now = new Date();
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const body = template
      .replace(/\{\{title\}\}/g, (doc.title || "").replace(/"/g, "'"))
      .replace(/\{\{url\}\}/g, doc.location.href)
      .replace(/\{\{date\}\}/g, date);
    return body.replace(/\n*$/, "\n\n");
  }

  function toast(text) {
    try {
      const id = "__copymark_toast";
      document.getElementById(id)?.remove();
      const el = document.createElement("div");
      el.id = id;
      el.textContent = text;
      el.style.cssText =
        "position:fixed;z-index:2147483647;right:16px;bottom:16px;" +
        "background:#16182d;color:#fff;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;" +
        "padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25)";
      document.documentElement.appendChild(el);
      setTimeout(() => el.remove(), 1800);
    } catch {
      /* cosmetic */
    }
  }

  let md = "";
  if (action === "selection") {
    md = S.selectionToMarkdown(document, opts);
    if (!md) return { ok: false, reason: "no-selection" };
  } else if (action === "selection-or-link") {
    md = S.selectionToMarkdown(document, opts) || S.pageLink(document);
  } else if (action === "link") {
    md = S.pageLink(document);
  } else if (action === "page") {
    const src = document.querySelector("article") || document.querySelector("main") || document.body;
    md = frontMatter(opts.frontMatter, document) + S.serialize(src, opts);
  }
  if (!md.trim()) return { ok: false, reason: "empty" };

  if (!writeInPage) return { ok: true, md, chars: md.length };

  const finish = (ok) => {
    if (ok) toast("CopyMark: copied as Markdown ✓");
    return { ok, md: ok ? "" : md, chars: md.length };
  };
  return navigator.clipboard.writeText(md).then(
    () => finish(true),
    () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = md;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return finish(ok);
      } catch {
        return finish(false);
      }
    }
  );
}

async function capture(tabId, action, { writeInPage }) {
  const settings = await getSettings();
  const opts = { ...settings, gfmTables: settings.pro };
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/md/serializer.js"]
  });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: pageCapture,
    args: [action, opts, !!writeInPage]
  });
  return res && res.result ? res.result : { ok: false, reason: "no-result" };
}

// All open tabs in the current window as a markdown link list (Pro).
async function tabsMarkdown() {
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const esc = (s) => (s || "").trim().replace(/([\\`*_[\]])/g, "\\$1");
  const lines = tabs
    .filter((t) => /^https?:/.test(t.url || ""))
    .map((t) => `${settings.bullet} [${esc(t.title) || t.url}](${t.url})`);
  return lines.join("\n") + "\n";
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "copymark-selection", title: "Copy selection as Markdown", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "copymark-link", title: "Copy page as Markdown link", contexts: ["page"] });
  chrome.contextMenus.create({ id: "copymark-page", title: "Copy full page as Markdown (Pro)", contexts: ["page"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || tab.id == null) return;
  try {
    if (info.menuItemId === "copymark-selection") await capture(tab.id, "selection", { writeInPage: true });
    else if (info.menuItemId === "copymark-link") await capture(tab.id, "link", { writeInPage: true });
    else if (info.menuItemId === "copymark-page") {
      const settings = await getSettings();
      if (!settings.pro) {
        chrome.runtime.openOptionsPage();
        return;
      }
      await capture(tab.id, "page", { writeInPage: true });
    }
  } catch {
    /* restricted page */
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "copy-selection" || !tab || tab.id == null) return;
  try {
    await capture(tab.id, "selection-or-link", { writeInPage: true });
  } catch {
    /* restricted page */
  }
});

// Popup delegates here; markdown is returned for the popup to write (the
// popup owns focus, so the clipboard write must happen there).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "capture" && msg.tabId != null) {
    capture(msg.tabId, msg.action, { writeInPage: false })
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) }));
    return true;
  }
  if (msg.type === "tabs-markdown") {
    tabsMarkdown()
      .then((md) => sendResponse({ ok: true, md, chars: md.length }))
      .catch((err) => sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) }));
    return true;
  }
});
