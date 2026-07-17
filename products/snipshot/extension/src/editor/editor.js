// SnipShot annotation editor. Everything runs on this page — the image
// never leaves the device.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const CFG = globalThis.SNIPSHOT_CONFIG;

  const PRO_TOOLS = new Set(["blur", "step", "ellipse"]);
  const KEY_TOOLS = { v: "select", a: "arrow", r: "rect", e: "ellipse", h: "highlight", t: "text", b: "blur", s: "step", c: "crop" };

  const state = {
    img: null,
    imgW: 0,
    imgH: 0,
    shapes: [],
    selectedId: null,
    tool: "select",
    color: CFG.FREE_COLORS[0],
    stroke: 4,
    crop: null, // {x,y,w,h} in image coords
    pendingCrop: null,
    stepCount: 0,
    undo: [],
    redo: [],
    pro: false,
    payConfigured: false,
    drawing: null, // in-progress shape
    drag: null // {id, dx, dy, moved}
  };

  let idSeq = 1;
  const newId = () => idSeq++;

  // ------------------------------------------------------------ utilities

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function snapshot() {
    return JSON.stringify({ shapes: state.shapes, crop: state.crop, stepCount: state.stepCount });
  }

  function restore(snap) {
    const data = JSON.parse(snap);
    state.shapes = data.shapes;
    state.crop = data.crop;
    state.stepCount = data.stepCount;
    state.selectedId = null;
    sizeCanvas();
    render();
  }

  function pushUndo() {
    state.undo.push(snapshot());
    if (state.undo.length > 50) state.undo.shift();
    state.redo.length = 0;
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(snapshot());
    restore(state.undo.pop());
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(snapshot());
    restore(state.redo.pop());
  }

  const cropX = () => (state.crop ? state.crop.x : 0);
  const cropY = () => (state.crop ? state.crop.y : 0);

  function sizeCanvas() {
    canvas.width = state.crop ? state.crop.w : state.imgW;
    canvas.height = state.crop ? state.crop.h : state.imgH;
    $("resetCropBtn").hidden = !state.crop;
  }

  // Pointer position in image coordinates (accounts for CSS scaling + crop).
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width) + cropX(),
      y: (e.clientY - rect.top) * (canvas.height / rect.height) + cropY()
    };
  }

  function normRect(s) {
    return {
      x: Math.min(s.x, s.x + s.w),
      y: Math.min(s.y, s.y + s.h),
      w: Math.abs(s.w),
      h: Math.abs(s.h)
    };
  }

  // ------------------------------------------------------------ rendering

  function drawShape(c, s, forExport) {
    c.save();
    c.lineWidth = s.stroke;
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineJoin = "round";
    c.lineCap = "round";

    if (s.type === "rect") {
      const r = normRect(s);
      c.beginPath();
      c.roundRect(r.x, r.y, r.w, r.h, 3);
      c.stroke();
    } else if (s.type === "ellipse") {
      const r = normRect(s);
      c.beginPath();
      c.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      c.stroke();
    } else if (s.type === "highlight") {
      const r = normRect(s);
      c.globalAlpha = 0.3;
      c.fillRect(r.x, r.y, r.w, r.h);
    } else if (s.type === "arrow") {
      const head = Math.max(12, s.stroke * 3.2);
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
      c.stroke();
      c.beginPath();
      c.moveTo(s.x2, s.y2);
      c.lineTo(s.x2 - head * Math.cos(angle - 0.45), s.y2 - head * Math.sin(angle - 0.45));
      c.lineTo(s.x2 - head * Math.cos(angle + 0.45), s.y2 - head * Math.sin(angle + 0.45));
      c.closePath();
      c.fill();
    } else if (s.type === "text") {
      c.font = `600 ${s.size}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      c.textBaseline = "top";
      c.lineWidth = Math.max(3, s.size / 7);
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.strokeText(s.text, s.x, s.y);
      c.fillText(s.text, s.x, s.y);
    } else if (s.type === "blur") {
      const r = normRect(s);
      if (r.w > 2 && r.h > 2) {
        const scale = 14;
        const tmp = document.createElement("canvas");
        tmp.width = Math.max(1, Math.round(r.w / scale));
        tmp.height = Math.max(1, Math.round(r.h / scale));
        const tctx = tmp.getContext("2d");
        tctx.drawImage(state.img, r.x, r.y, r.w, r.h, 0, 0, tmp.width, tmp.height);
        c.imageSmoothingEnabled = false;
        c.drawImage(tmp, 0, 0, tmp.width, tmp.height, r.x, r.y, r.w, r.h);
        c.imageSmoothingEnabled = true;
      }
    } else if (s.type === "step") {
      const r = 15 + s.stroke;
      c.beginPath();
      c.arc(s.x, s.y, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.font = `700 ${r}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(s.n), s.x, s.y + 1);
    }
    c.restore();

    if (!forExport && s.id === state.selectedId) {
      const b = bounds(s);
      c.save();
      c.strokeStyle = "#6366f1";
      c.lineWidth = 1.5;
      c.setLineDash([5, 4]);
      c.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
      c.restore();
    }
  }

  function renderTo(c, forExport) {
    const cx = cropX();
    const cy = cropY();
    c.save();
    c.translate(-cx, -cy);
    c.drawImage(state.img, 0, 0);
    for (const s of state.shapes) drawShape(c, s, forExport);
    if (!forExport && state.drawing) drawShape(c, state.drawing, false);
    if (!forExport && state.pendingCrop) {
      const r = normRect(state.pendingCrop);
      c.save();
      c.fillStyle = "rgba(10,12,30,0.45)";
      c.beginPath();
      c.rect(cx, cy, canvas.width, canvas.height);
      c.rect(r.x, r.y, r.w, r.h);
      c.fill("evenodd");
      c.strokeStyle = "#fff";
      c.setLineDash([6, 4]);
      c.lineWidth = 1.5;
      c.strokeRect(r.x, r.y, r.w, r.h);
      c.restore();
    }
    c.restore();
  }

  function render() {
    if (!state.img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderTo(ctx, false);
  }

  // ------------------------------------------------------------ hit testing

  function bounds(s) {
    if (s.type === "arrow") {
      return {
        x: Math.min(s.x1, s.x2),
        y: Math.min(s.y1, s.y2),
        w: Math.abs(s.x2 - s.x1),
        h: Math.abs(s.y2 - s.y1)
      };
    }
    if (s.type === "text") {
      ctx.save();
      ctx.font = `600 ${s.size}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      const w = ctx.measureText(s.text).width;
      ctx.restore();
      return { x: s.x, y: s.y, w, h: s.size * 1.25 };
    }
    if (s.type === "step") {
      const r = 15 + s.stroke;
      return { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 };
    }
    return normRect(s);
  }

  function distToSegment(p, a, b) {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (!l2) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  }

  function hitTest(pos) {
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const s = state.shapes[i];
      if (s.type === "arrow") {
        if (distToSegment(pos, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }) < 9 + s.stroke) return s;
        continue;
      }
      const b = bounds(s);
      const pad = s.type === "rect" || s.type === "ellipse" ? 6 : 2;
      if (pos.x >= b.x - pad && pos.x <= b.x + b.w + pad && pos.y >= b.y - pad && pos.y <= b.y + b.h + pad) {
        return s;
      }
    }
    return null;
  }

  // ------------------------------------------------------------ pro gating

  function requirePro(feature) {
    if (state.pro) return true;
    $("proUnavailable").hidden = state.payConfigured;
    $("proBuyBtn").hidden = !state.payConfigured;
    $("proRestoreBtn").hidden = !state.payConfigured;
    $("proDialog").showModal();
    return false;
  }

  async function refreshPro() {
    const status = await SnipShotPay.getStatus();
    state.payConfigured = status.configured;
    state.pro = status.paid;
    $("proBadge").hidden = !state.pro;
    $("upgradeBtn").hidden = !state.payConfigured || state.pro;
    $("customColorWrap").classList.toggle("unlocked", state.pro);
    document.querySelectorAll(".tool[data-pro]").forEach((b) => {
      b.classList.toggle("locked", !state.pro);
    });
  }

  // ------------------------------------------------------------ tools & UI

  function setTool(tool) {
    if (PRO_TOOLS.has(tool) && !state.pro) {
      requirePro(tool);
      return;
    }
    state.tool = tool;
    state.pendingCrop = null;
    $("cropBar").hidden = true;
    document.querySelectorAll("#tools .tool").forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === tool);
    });
    canvas.style.cursor = tool === "select" ? "default" : "crosshair";
    render();
  }

  document.querySelectorAll("#tools .tool").forEach((b) => {
    b.addEventListener("click", () => setTool(b.dataset.tool));
  });

  // color swatches
  const swatches = $("swatches");
  for (const color of CFG.FREE_COLORS) {
    const b = document.createElement("button");
    b.className = "swatch";
    b.style.background = color;
    b.title = color;
    b.addEventListener("click", () => {
      state.color = color;
      document.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      applyStyleToSelection({ color });
    });
    swatches.appendChild(b);
  }
  swatches.firstChild.classList.add("active");

  $("customColor").addEventListener("input", (e) => {
    if (!state.pro) {
      requirePro("color");
      return;
    }
    state.color = e.target.value;
    document.querySelectorAll(".swatch").forEach((x) => x.classList.remove("active"));
    applyStyleToSelection({ color: state.color });
  });

  $("strokeSelect").addEventListener("change", (e) => {
    state.stroke = parseInt(e.target.value, 10);
    applyStyleToSelection({ stroke: state.stroke });
  });

  function applyStyleToSelection(patch) {
    const s = state.shapes.find((x) => x.id === state.selectedId);
    if (s) {
      pushUndo();
      Object.assign(s, patch);
      render();
    }
  }

  $("undoBtn").addEventListener("click", undo);
  $("redoBtn").addEventListener("click", redo);
  $("resetCropBtn").addEventListener("click", () => {
    pushUndo();
    state.crop = null;
    sizeCanvas();
    render();
  });

  // ------------------------------------------------------------ pointer flow

  canvas.addEventListener("pointerdown", (e) => {
    if (!state.img || e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    const pos = getPos(e);

    if (state.tool === "select") {
      const hit = hitTest(pos);
      state.selectedId = hit ? hit.id : null;
      if (hit) {
        state.drag = { id: hit.id, start: pos, orig: JSON.stringify(hit), moved: false };
      }
      render();
      return;
    }

    if (state.tool === "text") {
      // Stop the click's default focus change from instantly blurring the
      // floating input we're about to open.
      e.preventDefault();
      startTextEntry(pos);
      return;
    }

    if (state.tool === "step") {
      pushUndo();
      state.stepCount++;
      state.shapes.push({ id: newId(), type: "step", x: pos.x, y: pos.y, n: state.stepCount, color: state.color, stroke: state.stroke });
      render();
      return;
    }

    if (state.tool === "crop") {
      state.pendingCrop = { x: pos.x, y: pos.y, w: 0, h: 0 };
      $("cropBar").hidden = true;
      render();
      return;
    }

    // drag-to-draw tools
    state.drawing =
      state.tool === "arrow"
        ? { id: newId(), type: "arrow", x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color: state.color, stroke: state.stroke }
        : { id: newId(), type: state.tool, x: pos.x, y: pos.y, w: 0, h: 0, color: state.color, stroke: state.stroke };
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!state.img) return;
    const pos = getPos(e);

    if (state.drawing) {
      if (state.drawing.type === "arrow") {
        state.drawing.x2 = pos.x;
        state.drawing.y2 = pos.y;
      } else {
        state.drawing.w = pos.x - state.drawing.x;
        state.drawing.h = pos.y - state.drawing.y;
      }
      render();
    } else if (state.pendingCrop && e.buttons) {
      state.pendingCrop.w = pos.x - state.pendingCrop.x;
      state.pendingCrop.h = pos.y - state.pendingCrop.y;
      render();
    } else if (state.drag) {
      const s = state.shapes.find((x) => x.id === state.drag.id);
      if (!s) return;
      if (!state.drag.moved) {
        pushUndo();
        state.drag.moved = true;
      }
      const dx = pos.x - state.drag.start.x;
      const dy = pos.y - state.drag.start.y;
      const orig = JSON.parse(state.drag.orig);
      if (s.type === "arrow") {
        s.x1 = orig.x1 + dx;
        s.y1 = orig.y1 + dy;
        s.x2 = orig.x2 + dx;
        s.y2 = orig.y2 + dy;
      } else {
        s.x = orig.x + dx;
        s.y = orig.y + dy;
      }
      render();
    }
  });

  canvas.addEventListener("pointerup", () => {
    if (state.drawing) {
      const d = state.drawing;
      const big =
        d.type === "arrow"
          ? Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 6
          : Math.abs(d.w) > 5 && Math.abs(d.h) > 5;
      if (big) {
        pushUndo();
        state.shapes.push(d);
        state.selectedId = null;
      }
      state.drawing = null;
      render();
    }
    if (state.pendingCrop) {
      const r = normRect(state.pendingCrop);
      if (r.w > 10 && r.h > 10) {
        $("cropBar").hidden = false;
      } else {
        state.pendingCrop = null;
        render();
      }
    }
    state.drag = null;
  });

  $("cropApply").addEventListener("click", () => {
    const r = normRect(state.pendingCrop);
    pushUndo();
    state.crop = {
      x: Math.max(0, Math.round(r.x)),
      y: Math.max(0, Math.round(r.y)),
      w: Math.min(state.imgW, Math.round(r.w)),
      h: Math.min(state.imgH, Math.round(r.h))
    };
    state.pendingCrop = null;
    $("cropBar").hidden = true;
    setTool("select");
    sizeCanvas();
    render();
  });

  $("cropCancel").addEventListener("click", () => {
    state.pendingCrop = null;
    $("cropBar").hidden = true;
    render();
  });

  // ------------------------------------------------------------ text entry

  function startTextEntry(pos, existing) {
    const input = $("textEditor");
    const rect = canvas.getBoundingClientRect();
    const wrap = $("canvasWrap").getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const size = existing ? existing.size : Math.max(18, state.stroke * 6);
    input.style.left = `${rect.left - wrap.left + (pos.x - cropX()) * scale}px`;
    input.style.top = `${rect.top - wrap.top + (pos.y - cropY()) * scale}px`;
    input.style.fontSize = `${size * scale}px`;
    input.style.color = state.color;
    input.value = existing ? existing.text : "";
    input.hidden = false;
    requestAnimationFrame(() => input.focus());

    const commit = () => {
      input.hidden = true;
      const text = input.value.trim();
      input.removeEventListener("blur", commit);
      if (!text) return;
      pushUndo();
      if (existing) {
        existing.text = text;
      } else {
        state.shapes.push({ id: newId(), type: "text", x: pos.x, y: pos.y, text, size, color: state.color, stroke: state.stroke });
      }
      render();
    };
    input.addEventListener("blur", commit);
    input.onkeydown = (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.value = "";
        input.blur();
      }
    };
  }

  canvas.addEventListener("dblclick", (e) => {
    const pos = getPos(e);
    const hit = hitTest(pos);
    if (hit && hit.type === "text") {
      state.selectedId = hit.id;
      startTextEntry({ x: hit.x, y: hit.y }, hit);
    }
  });

  // ------------------------------------------------------------ keyboard

  document.addEventListener("keydown", (e) => {
    if (!$("textEditor").hidden || e.target instanceof HTMLInputElement) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    } else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
      pushUndo();
      state.shapes = state.shapes.filter((s) => s.id !== state.selectedId);
      state.selectedId = null;
      render();
    } else if (e.key === "Escape") {
      state.pendingCrop = null;
      state.selectedId = null;
      $("cropBar").hidden = true;
      render();
    } else if (KEY_TOOLS[e.key.toLowerCase()] && !mod) {
      setTool(KEY_TOOLS[e.key.toLowerCase()]);
    }
  });

  // ------------------------------------------------------------ export

  function exportCanvas() {
    const out = document.createElement("canvas");
    out.width = state.crop ? state.crop.w : state.imgW;
    out.height = state.crop ? state.crop.h : state.imgH;
    renderTo(out.getContext("2d"), true);
    return out;
  }

  $("downloadBtn").addEventListener("click", () => {
    exportCanvas().toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ts = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      a.download = `snipshot-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Downloaded ✓");
    }, "image/png");
  });

  $("copyBtn").addEventListener("click", () => {
    exportCanvas().toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast("Copied to clipboard ✓");
      } catch {
        toast("Copy failed — use Download instead");
      }
    }, "image/png");
  });

  // ------------------------------------------------------------ pro dialog

  $("upgradeBtn").addEventListener("click", () => requirePro("upgrade"));
  $("proBuyBtn").addEventListener("click", () => SnipShotPay.openPaymentPage());
  $("proRestoreBtn").addEventListener("click", () => SnipShotPay.openLoginPage());
  $("proCloseBtn").addEventListener("click", () => $("proDialog").close());
  $("proPrice").textContent = CFG.PRO_PRICE_LABEL;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshPro();
  });

  // ------------------------------------------------------------ boot

  function makeDemoImage() {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 720;
    const g = c.getContext("2d");
    g.fillStyle = "#f4f5fa";
    g.fillRect(0, 0, 1200, 720);
    const grad = g.createLinearGradient(0, 0, 1200, 0);
    grad.addColorStop(0, "#6366f1");
    grad.addColorStop(1, "#8b5cf6");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1200, 92);
    g.fillStyle = "#fff";
    g.font = "700 30px sans-serif";
    g.fillText("Acme Dashboard", 36, 58);
    g.fillStyle = "#fff";
    for (let i = 0; i < 3; i++) {
      g.save();
      g.shadowColor = "rgba(20,20,60,0.12)";
      g.shadowBlur = 18;
      g.fillRect(36 + i * 385, 140, 350, 180);
      g.restore();
      g.fillStyle = "#16182d";
      g.font = "700 40px sans-serif";
      g.fillText(["$12,480", "3,214", "98.2%"][i], 66 + i * 385, 230);
      g.font = "500 17px sans-serif";
      g.fillStyle = "#6b7280";
      g.fillText(["Monthly revenue", "Active users", "Uptime"][i], 66 + i * 385, 270);
      g.fillStyle = "#fff";
    }
    g.fillStyle = "#16182d";
    g.font = "600 22px sans-serif";
    g.fillText("Recent activity", 36, 390);
    g.font = "400 17px sans-serif";
    g.fillStyle = "#4b5563";
    const rows = [
      "jordan@acme.com upgraded to the Team plan",
      "Invoice #10024 was paid — $249.00",
      "New API key created by sam@acme.com",
      "Weekly report emailed to 12 recipients"
    ];
    rows.forEach((row, i) => {
      g.fillText("•  " + row, 36, 430 + i * 40);
    });
    return c.toDataURL("image/png");
  }

  function loadImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.imgW = img.naturalWidth;
      state.imgH = img.naturalHeight;
      sizeCanvas();
      render();
    };
    img.src = dataUrl;
  }

  async function boot() {
    await refreshPro();
    setTool("arrow");

    const params = new URLSearchParams(location.search);
    if (params.get("err") === "restricted") {
      $("notice").hidden = false;
      $("notice").textContent =
        "Chrome doesn't allow capturing that page type (chrome:// pages, the Web Store, etc.). Here's a demo image to play with — try any normal website.";
      loadImage(makeDemoImage());
      return;
    }

    chrome.storage.local.get({ pendingCapture: null }, ({ pendingCapture }) => {
      if (pendingCapture && pendingCapture.dataUrl) {
        loadImage(pendingCapture.dataUrl);
        if (params.get("demo")) {
          // fresh install with a real capture already queued — unlikely, ignore
        }
      } else {
        loadImage(makeDemoImage());
        if (params.get("demo")) {
          $("notice").hidden = false;
          $("notice").textContent =
            "Welcome! This is a demo image — try the arrow, box, and text tools, then hit Download. To capture a real page, click the SnipShot icon (or Alt+Shift+S) on any website.";
        }
      }
    });
  }

  // Test/debug handle (harmless in production; nothing sensitive inside).
  globalThis.__snipshot = { state, exportCanvas, render, undo, redo };

  boot();
})();
