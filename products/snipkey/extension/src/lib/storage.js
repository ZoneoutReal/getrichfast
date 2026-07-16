// SnipKey storage layer. All data lives in chrome.storage.local — nothing
// ever leaves the browser.
globalThis.SnipKeyStore = (() => {
  const DEFAULT_SETTINGS = {
    prefix: "/",
    expandMode: "instant", // "instant" | "delimiter"
    enabled: true
  };

  const SHORTCUT_RE = new RegExp(globalThis.SNIPKEY_CONFIG.SHORTCUT_PATTERN);

  function get(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function set(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
  }

  async function getAll() {
    const data = await get({
      snippets: [],
      settings: DEFAULT_SETTINGS,
      stats: { total: 0, byId: {} }
    });
    data.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    return data;
  }

  function validateShortcut(shortcut) {
    if (!SHORTCUT_RE.test(shortcut)) {
      throw Object.assign(
        new Error("Shortcuts can use letters, numbers, - and _ (max 32 chars)."),
        { code: "INVALID" }
      );
    }
  }

  async function addSnippet({ shortcut, text }, isPro) {
    validateShortcut(shortcut);
    if (!text || !text.trim()) {
      throw Object.assign(new Error("Snippet text can't be empty."), { code: "EMPTY" });
    }
    const { snippets } = await getAll();
    if (snippets.some((s) => s.shortcut.toLowerCase() === shortcut.toLowerCase())) {
      throw Object.assign(new Error(`"${shortcut}" is already taken.`), { code: "DUPLICATE" });
    }
    if (!isPro && snippets.length >= globalThis.SNIPKEY_CONFIG.FREE_SNIPPET_LIMIT) {
      throw Object.assign(
        new Error("Free plan holds " + globalThis.SNIPKEY_CONFIG.FREE_SNIPPET_LIMIT + " snippets."),
        { code: "LIMIT" }
      );
    }
    const snippet = {
      id: crypto.randomUUID(),
      shortcut,
      text,
      createdAt: Date.now()
    };
    snippets.push(snippet);
    await set({ snippets });
    return snippet;
  }

  async function updateSnippet(id, patch) {
    if (patch.shortcut !== undefined) validateShortcut(patch.shortcut);
    const { snippets } = await getAll();
    const i = snippets.findIndex((s) => s.id === id);
    if (i === -1) throw new Error("Snippet not found.");
    if (
      patch.shortcut !== undefined &&
      snippets.some((s, j) => j !== i && s.shortcut.toLowerCase() === patch.shortcut.toLowerCase())
    ) {
      throw Object.assign(new Error(`"${patch.shortcut}" is already taken.`), { code: "DUPLICATE" });
    }
    snippets[i] = Object.assign({}, snippets[i], patch);
    await set({ snippets });
    return snippets[i];
  }

  async function deleteSnippet(id) {
    const { snippets } = await getAll();
    await set({ snippets: snippets.filter((s) => s.id !== id) });
  }

  async function saveSettings(patch) {
    const { settings } = await getAll();
    await set({ settings: Object.assign({}, settings, patch) });
  }

  async function exportJSON() {
    const { snippets, settings } = await getAll();
    return JSON.stringify({ app: "snipkey", version: 1, settings, snippets }, null, 2);
  }

  // Imports snippets from an export file. Non-Pro imports stop at the free
  // limit; duplicates (by shortcut) are skipped either way.
  async function importJSON(text, isPro) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
    const incoming = Array.isArray(parsed) ? parsed : parsed.snippets;
    if (!Array.isArray(incoming)) throw new Error("No snippets found in that file.");
    const { snippets } = await getAll();
    const taken = new Set(snippets.map((s) => s.shortcut.toLowerCase()));
    let imported = 0;
    let skipped = 0;
    for (const item of incoming) {
      const shortcut = String(item.shortcut || "");
      const body = String(item.text || "");
      const atLimit =
        !isPro && snippets.length >= globalThis.SNIPKEY_CONFIG.FREE_SNIPPET_LIMIT;
      if (!SHORTCUT_RE.test(shortcut) || !body.trim() || taken.has(shortcut.toLowerCase()) || atLimit) {
        skipped++;
        continue;
      }
      snippets.push({
        id: crypto.randomUUID(),
        shortcut,
        text: body,
        createdAt: Date.now()
      });
      taken.add(shortcut.toLowerCase());
      imported++;
    }
    await set({ snippets });
    return { imported, skipped };
  }

  return {
    DEFAULT_SETTINGS,
    getAll,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    saveSettings,
    exportJSON,
    importJSON
  };
})();
