// FocusFence background: keeps declarativeNetRequest dynamic rules in sync
// with settings + session/schedule state, runs the focus-session timer, and
// paints the badge countdown.
importScripts("lib/config.js", "lib/rules.js", "lib/ExtPay.js");

if (FOCUSFENCE_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(FOCUSFENCE_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

const DEFAULTS = {
  sites: [],
  alwaysOn: false,
  schedules: [],
  strict: false,
  blockMessage: "",
  session: null, // { endsAt, startedAt }
  pro: false
};

async function getState() {
  const { state } = await chrome.storage.local.get({ state: DEFAULTS });
  return { ...DEFAULTS, ...state };
}

async function setState(patch) {
  const state = { ...(await getState()), ...patch };
  await chrome.storage.local.set({ state });
  await sync();
  return state;
}

// The one source of truth: storage state → dNR rules + badge + alarms.
async function sync() {
  const state = await getState();
  const active = FocusFenceRules.blockingActive(state);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  let addRules = [];
  if (active && state.sites.length) {
    const sites = state.pro ? state.sites : state.sites.filter((s) => !FocusFenceRules.isProPattern(s)).slice(0, FOCUSFENCE_CONFIG.FREE_SITE_LIMIT);
    addRules = FocusFenceRules.buildRules(sites, chrome.runtime.getURL("src/blocked/blocked.html"));
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });

  // badge: session countdown (minutes) > always-on dot > schedule dot
  if (state.session && state.session.endsAt > Date.now()) {
    const minsLeft = Math.max(1, Math.ceil((state.session.endsAt - Date.now()) / 60000));
    chrome.action.setBadgeText({ text: String(minsLeft) });
    chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    chrome.alarms.create("ff-tick", { periodInMinutes: 1 });
    chrome.alarms.create("ff-session-end", { when: state.session.endsAt });
  } else {
    if (state.session) await chrome.storage.local.set({ state: { ...state, session: null } });
    chrome.action.setBadgeText({ text: active ? "ON" : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
    chrome.alarms.clear("ff-session-end");
    if (state.pro && state.schedules.length) chrome.alarms.create("ff-tick", { periodInMinutes: 1 });
    else chrome.alarms.clear("ff-tick");
  }
  return { active, ruleCount: addRules.length };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ff-session-end" || alarm.name === "ff-tick") sync();
});

chrome.runtime.onInstalled.addListener(() => sync());
chrome.runtime.onStartup.addListener(() => sync());

// Popup/options delegate state changes here so rule-sync stays in one place.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  const respond = (p) =>
    p
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));

  if (msg.type === "get-state") {
    respond(getState().then((state) => ({ state, active: FocusFenceRules.blockingActive(state) })));
    return true;
  }
  if (msg.type === "set-state") {
    // Strict mode: the block list and switches are frozen while a session runs.
    respond(
      getState().then(async (state) => {
        const sessionRunning = state.session && state.session.endsAt > Date.now();
        if (state.strict && sessionRunning && !msg.allowInStrict) {
          throw new Error("strict-mode");
        }
        const next = await setState(msg.patch || {});
        return { state: next };
      })
    );
    return true;
  }
  if (msg.type === "start-session") {
    respond(
      setState({ session: { startedAt: Date.now(), endsAt: Date.now() + msg.minutes * 60000 } }).then((state) => ({ state }))
    );
    return true;
  }
  if (msg.type === "end-session") {
    respond(
      getState().then(async (state) => {
        if (state.strict && state.session && state.session.endsAt > Date.now()) throw new Error("strict-mode");
        const next = await setState({ session: null });
        return { state: next };
      })
    );
    return true;
  }
  if (msg.type === "sync") {
    respond(sync().then((r) => r));
    return true;
  }
});
