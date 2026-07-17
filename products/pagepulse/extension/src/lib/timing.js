// PagePulse timing engine: pure helpers for job scheduling, jitter, badge
// text, and monitor change detection. No chrome.* APIs — the same file runs
// in the service worker and the test harness.
(() => {
  // Next fire time for a job. Jitter (Pro) spreads reloads by ±pct of the
  // interval so monitored sites don't see metronome traffic.
  function nextFireAt(job, now) {
    const base = job.intervalSec * 1000;
    let delta = base;
    if (job.jitterPct > 0) {
      const spread = base * (job.jitterPct / 100);
      delta = base - spread + Math.random() * 2 * spread;
    }
    return now + Math.max(1000, Math.round(delta));
  }

  // Which jobs are due, given persisted state after a service-worker nap.
  function dueJobs(jobs, now) {
    return Object.values(jobs).filter((j) => j.nextAt <= now);
  }

  // Badge shows the remaining time compactly: 9s, 45s, 3m, 2h.
  function badgeText(msLeft) {
    const s = Math.max(0, Math.ceil(msLeft / 1000));
    if (s < 100) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 100) return `${m}m`;
    return `${Math.round(m / 60)}h`;
  }

  function fmtInterval(sec) {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return sec % 60 === 0 ? `${sec / 60}m` : `${Math.floor(sec / 60)}m${sec % 60}s`;
    return `${Math.round(sec / 3600)}h`;
  }

  // Monitor (Pro): compare page text snapshots. Reports whether the page
  // changed and whether a watched keyword appeared/disappeared.
  function hashText(text) {
    let h = 5381;
    const s = String(text || "");
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h;
  }

  function monitorDiff(prev, text, keyword) {
    const norm = String(text || "").replace(/\s+/g, " ").trim();
    const hash = hashText(norm);
    const kw = String(keyword || "").trim().toLowerCase();
    const hasKeyword = kw ? norm.toLowerCase().includes(kw) : null;
    const result = {
      hash,
      hasKeyword,
      changed: prev != null && prev.hash != null && prev.hash !== hash,
      keywordAppeared: !!(kw && prev && prev.hasKeyword === false && hasKeyword === true),
      keywordGone: !!(kw && prev && prev.hasKeyword === true && hasKeyword === false)
    };
    return result;
  }

  // Sanitizes a user-entered custom interval (Pro). Returns seconds or null.
  function parseInterval(input, minSec) {
    const s = String(input || "").trim().toLowerCase();
    if (!s) return null;
    const m = /^(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?|h|hours?)?$/.exec(s);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const unit = (m[2] || "s")[0];
    const sec = Math.round(unit === "h" ? n * 3600 : unit === "m" ? n * 60 : n);
    if (!Number.isFinite(sec) || sec < (minSec || 1) || sec > 24 * 3600) return null;
    return sec;
  }

  globalThis.PagePulseTiming = { nextFireAt, dueJobs, badgeText, fmtInterval, hashText, monitorDiff, parseInterval };
})();
