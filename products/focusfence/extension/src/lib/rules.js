// FocusFence rules engine: user patterns → declarativeNetRequest rules, and
// schedule evaluation. Pure functions, no chrome.* APIs — the same file runs
// in the service worker, the options page, and the test harness.
(() => {
  // Normalizes what people actually type into a blockable pattern:
  //   "facebook.com", "https://www.reddit.com/r/all", "*.tiktok.com",
  //   "news.ycombinator.com" — all fine.
  // Returns { domain, path } or null if unusable.
  function parsePattern(input) {
    let s = String(input || "").trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // strip scheme
    s = s.replace(/^www\./, "");
    const wildcard = s.startsWith("*.");
    if (wildcard) s = s.slice(2);
    const slash = s.indexOf("/");
    let domain = slash === -1 ? s : s.slice(0, slash);
    let path = slash === -1 ? "" : s.slice(slash).replace(/[?#].*$/, "").replace(/\/+$/, "");
    domain = domain.replace(/:\d+$/, "");
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) return null;
    if (path === "/") path = "";
    return { domain, path, wildcard: wildcard || !path };
  }

  // Path patterns are a Pro feature; free tier blocks whole domains.
  function isProPattern(input) {
    const p = parsePattern(input);
    return !!(p && p.path);
  }

  // dNR rule for one pattern. `||domain^` matches the domain and all its
  // subdomains; adding a path narrows it.
  function toRule(input, id, blockedPageUrl) {
    const p = parsePattern(input);
    if (!p) return null;
    const urlFilter = p.path ? `||${p.domain}${p.path}` : `||${p.domain}^`;
    return {
      id,
      priority: 1,
      action: blockedPageUrl
        ? { type: "redirect", redirect: { url: `${blockedPageUrl}?from=${encodeURIComponent(p.domain)}` } }
        : { type: "block" },
      condition: { urlFilter, resourceTypes: ["main_frame"] }
    };
  }

  function buildRules(patterns, blockedPageUrl) {
    const rules = [];
    let id = 1;
    for (const raw of patterns) {
      const rule = toRule(raw, id, blockedPageUrl);
      if (rule) {
        rules.push(rule);
        id++;
      }
    }
    return rules;
  }

  // ---- schedules ------------------------------------------------------------
  // schedule: { days: [0-6, sunday=0], start: "09:00", end: "17:30" }
  // Overnight spans (start > end, e.g. 22:00–06:00) wrap into the next day.
  function toMinutes(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  function scheduleActiveAt(schedule, date) {
    if (!schedule || !Array.isArray(schedule.days) || !schedule.days.length) return false;
    const start = toMinutes(schedule.start);
    const end = toMinutes(schedule.end);
    if (start == null || end == null || start === end) return false;
    const day = date.getDay();
    const now = date.getHours() * 60 + date.getMinutes();
    if (start < end) {
      return schedule.days.includes(day) && now >= start && now < end;
    }
    // overnight: active if (today scheduled && after start) or (yesterday scheduled && before end)
    const prevDay = (day + 6) % 7;
    return (schedule.days.includes(day) && now >= start) || (schedule.days.includes(prevDay) && now < end);
  }

  function anyScheduleActiveAt(schedules, date) {
    return Array.isArray(schedules) && schedules.some((s) => scheduleActiveAt(s, date));
  }

  // Blocking is on if: a manual focus session is running, always-on is set,
  // or (Pro) a schedule matches now.
  function blockingActive(state, now = new Date()) {
    if (state.session && state.session.endsAt > now.getTime()) return true;
    if (state.alwaysOn) return true;
    if (state.pro && anyScheduleActiveAt(state.schedules, now)) return true;
    return false;
  }

  globalThis.FocusFenceRules = {
    parsePattern,
    isProPattern,
    toRule,
    buildRules,
    toMinutes,
    scheduleActiveAt,
    anyScheduleActiveAt,
    blockingActive
  };
})();
