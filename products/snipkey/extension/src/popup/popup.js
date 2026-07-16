(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let all = { snippets: [], settings: SnipKeyStore.DEFAULT_SETTINGS, stats: { total: 0 } };
  let pay = { configured: false, paid: false };

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1600);
  }

  function openOptions(params) {
    const url = chrome.runtime.getURL("src/options/options.html") + (params || "");
    chrome.tabs.create({ url });
  }

  function render() {
    const q = $("search").value.trim().toLowerCase();
    const list = $("list");
    list.textContent = "";
    const filtered = all.snippets.filter(
      (s) => !q || s.shortcut.toLowerCase().includes(q) || s.text.toLowerCase().includes(q)
    );
    for (const s of filtered) {
      const li = document.createElement("li");
      li.title = "Edit in manager";
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = all.settings.prefix + s.shortcut;
      const preview = document.createElement("span");
      preview.className = "preview";
      preview.textContent = s.text.replace(/\s+/g, " ");
      li.append(chip, preview);
      li.addEventListener("click", () => openOptions("?edit=" + encodeURIComponent(s.id)));
      list.appendChild(li);
    }
    $("empty").hidden = all.snippets.length > 0;

    const limit = SNIPKEY_CONFIG.FREE_SNIPPET_LIMIT;
    $("countLabel").textContent = pay.paid
      ? `${all.snippets.length} snippets · Pro`
      : `${all.snippets.length} / ${limit} snippets`;
    $("statsLabel").textContent = all.stats.total ? `⚡ ${all.stats.total} expansions` : "";
    $("upgradeBanner").hidden = !(
      pay.configured && !pay.paid && all.snippets.length >= limit - 2
    );
    $("prefixLabel").textContent = all.settings.prefix;
    $("enabledToggle").checked = all.settings.enabled;
  }

  async function refresh() {
    all = await SnipKeyStore.getAll();
    render();
  }

  $("search").addEventListener("input", render);

  $("newBtn").addEventListener("click", () => {
    $("addForm").hidden = false;
    $("newShortcut").focus();
  });

  $("cancelAdd").addEventListener("click", () => {
    $("addForm").hidden = true;
    $("formError").textContent = "";
  });

  $("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await SnipKeyStore.addSnippet(
        { shortcut: $("newShortcut").value.trim(), text: $("newText").value },
        pay.paid
      );
      $("newShortcut").value = "";
      $("newText").value = "";
      $("addForm").hidden = true;
      $("formError").textContent = "";
      toast("Snippet saved");
      refresh();
    } catch (err) {
      $("formError").textContent = err.message;
      if (err.code === "LIMIT" && pay.configured) $("upgradeBanner").hidden = false;
    }
  });

  $("enabledToggle").addEventListener("change", async (e) => {
    await SnipKeyStore.saveSettings({ enabled: e.target.checked });
    toast(e.target.checked ? "Expansion on" : "Expansion paused");
  });

  $("manageLink").addEventListener("click", (e) => {
    e.preventDefault();
    openOptions("");
  });

  $("upgradeBtn").addEventListener("click", () => SnipKeyPay.openPaymentPage());

  chrome.storage.onChanged.addListener(refresh);

  (async () => {
    pay = await SnipKeyPay.getStatus();
    refresh();
  })();
})();
