(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let all = { snippets: [], settings: SnipKeyStore.DEFAULT_SETTINGS, stats: { total: 0, byId: {} } };
  let pay = { configured: false, paid: false };
  let editingId = null;

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1800);
  }

  // ------------------------------------------------------------- rendering

  function render() {
    const q = $("search").value.trim().toLowerCase();
    const rows = $("rows");
    rows.textContent = "";
    const filtered = all.snippets
      .slice()
      .sort((a, b) => a.shortcut.localeCompare(b.shortcut))
      .filter((s) => !q || s.shortcut.toLowerCase().includes(q) || s.text.toLowerCase().includes(q));

    for (const s of filtered) {
      const tr = document.createElement("tr");

      const tdShortcut = document.createElement("td");
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = all.settings.prefix + s.shortcut;
      tdShortcut.appendChild(chip);

      const tdText = document.createElement("td");
      const preview = document.createElement("div");
      preview.className = "preview";
      preview.textContent = s.text;
      tdText.appendChild(preview);

      const tdUses = document.createElement("td");
      tdUses.className = "num";
      tdUses.textContent = (all.stats.byId && all.stats.byId[s.id]) || 0;

      const tdActions = document.createElement("td");
      tdActions.className = "num";
      const del = document.createElement("button");
      del.className = "btn btn-ghost rowdel";
      del.textContent = "🗑";
      del.title = "Delete snippet";
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        await SnipKeyStore.deleteSnippet(s.id);
        toast(`Deleted ${all.settings.prefix}${s.shortcut}`);
        refresh();
      });
      tdActions.appendChild(del);

      tr.append(tdShortcut, tdText, tdUses, tdActions);
      tr.addEventListener("click", () => openEditor(s));
      rows.appendChild(tr);
    }

    $("empty").hidden = all.snippets.length > 0;
    $("statCount").textContent = all.snippets.length;
    $("statUses").textContent = all.stats.total || 0;

    const limit = SNIPKEY_CONFIG.FREE_SNIPPET_LIMIT;
    const planLabel = pay.paid ? "Pro — unlimited" : `Free — ${all.snippets.length}/${limit}`;
    $("statPlan").textContent = planLabel;
    $("planBadge").textContent = pay.paid ? "Pro" : "Free";
    $("proCard").hidden = !pay.configured || pay.paid;
    $("priceLabel").textContent = SNIPKEY_CONFIG.PRO_PRICE_LABEL;

    $("prefixSelect").value = all.settings.prefix;
    $("modeSelect").value = all.settings.expandMode;
    $("enabledToggle").checked = all.settings.enabled;
    $("editorPrefix").textContent = all.settings.prefix;
    $("homeLink").href = SNIPKEY_CONFIG.HOMEPAGE;
  }

  async function refresh() {
    all = await SnipKeyStore.getAll();
    render();
  }

  // ------------------------------------------------------------- editor

  function openEditor(snippet) {
    editingId = snippet ? snippet.id : null;
    $("editorTitle").textContent = snippet ? "Edit snippet" : "New snippet";
    $("editShortcut").value = snippet ? snippet.shortcut : "";
    $("editText").value = snippet ? snippet.text : "";
    $("deleteBtn").hidden = !snippet;
    $("editorError").textContent = "";
    $("editor").showModal();
    $("editShortcut").focus();
  }

  $("editorForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const shortcut = $("editShortcut").value.trim();
    const text = $("editText").value;
    try {
      if (editingId) {
        await SnipKeyStore.updateSnippet(editingId, { shortcut, text });
        toast("Snippet updated");
      } else {
        await SnipKeyStore.addSnippet({ shortcut, text }, pay.paid);
        toast("Snippet created");
      }
      $("editor").close();
      refresh();
    } catch (err) {
      $("editorError").textContent = err.message;
      if (err.code === "LIMIT" && pay.configured) {
        $("editorError").textContent += " Upgrade to Pro for unlimited.";
      }
    }
  });

  $("deleteBtn").addEventListener("click", async () => {
    if (!editingId) return;
    await SnipKeyStore.deleteSnippet(editingId);
    $("editor").close();
    toast("Snippet deleted");
    refresh();
  });

  $("cancelBtn").addEventListener("click", () => $("editor").close());
  $("newBtn").addEventListener("click", () => openEditor(null));
  $("search").addEventListener("input", render);

  // ------------------------------------------------------------- settings

  $("prefixSelect").addEventListener("change", async (e) => {
    await SnipKeyStore.saveSettings({ prefix: e.target.value });
    toast(`Trigger prefix is now ${e.target.value}`);
    refresh();
  });

  $("modeSelect").addEventListener("change", async (e) => {
    await SnipKeyStore.saveSettings({ expandMode: e.target.value });
    refresh();
  });

  $("enabledToggle").addEventListener("change", async (e) => {
    await SnipKeyStore.saveSettings({ enabled: e.target.checked });
  });

  // ------------------------------------------------------------- data

  $("exportBtn").addEventListener("click", async () => {
    const json = await SnipKeyStore.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "snipkey-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { imported, skipped } = await SnipKeyStore.importJSON(await file.text(), pay.paid);
      toast(`Imported ${imported} snippet${imported === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}`);
      refresh();
    } catch (err) {
      toast(err.message);
    }
    e.target.value = "";
  });

  // ------------------------------------------------------------- payments

  $("payBtn").addEventListener("click", () => SnipKeyPay.openPaymentPage());
  $("restoreLink").addEventListener("click", (e) => {
    e.preventDefault();
    SnipKeyPay.openLoginPage();
  });

  // ------------------------------------------------------------- boot

  chrome.storage.onChanged.addListener(refresh);

  const params = new URLSearchParams(location.search);
  if (params.get("welcome")) {
    $("welcome").hidden = false;
    $("welcomeClose").addEventListener("click", () => ($("welcome").hidden = true));
  }

  (async () => {
    pay = await SnipKeyPay.getStatus();
    await refresh();
    const editId = params.get("edit");
    if (editId) {
      const snippet = all.snippets.find((s) => s.id === editId);
      if (snippet) openEditor(snippet);
    }
  })();
})();
