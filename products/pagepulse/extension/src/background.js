// PagePulse background: per-tab reload jobs driven by a setTimeout chain
// (second-level precision; each tick's API call keeps the worker alive) with
// a 1-minute recovery alarm + persisted nextAt as the safety net, so jobs
// survive service-worker restarts.
importScripts("lib/config.js", "lib/timing.js", "lib/ExtPay.js");

if (PAGEPULSE_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(PAGEPULSE_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

const T = PagePulseTiming;
let timer = null;

async function getJobs() {
  const { jobs } = await chrome.storage.local.get({ jobs: {} });
  return jobs;
}

async function setJobs(jobs) {
  await chrome.storage.local.set({ jobs });
  await arm();
  return jobs;
}

// ---- the tick loop --------------------------------------------------------
async function tick() {
  const now = Date.now();
  const jobs = await getJobs();
  let dirty = false;

  for (const job of T.dueJobs(jobs, now)) {
    try {
      await chrome.tabs.reload(job.tabId, { bypassCache: !!job.hardReload });
      job.lastReloadAt = now;
      job.reloads = (job.reloads || 0) + 1;
      if (job.monitor && job.monitor.enabled) scheduleMonitorCheck(job);
    } catch {
      // tab is gone — drop the job
      delete jobs[job.tabId];
      chrome.action.setBadgeText({ tabId: job.tabId, text: "" }).catch(() => {});
      dirty = true;
      continue;
    }
    job.nextAt = T.nextFireAt(job, now);
    dirty = true;
  }
  if (dirty) await chrome.storage.local.set({ jobs });

  // per-tab badges: live countdown
  for (const job of Object.values(jobs)) {
    chrome.action
      .setBadgeText({ tabId: job.tabId, text: T.badgeText(job.nextAt - now) })
      .catch(() => {});
  }
  chrome.action.setBadgeBackgroundColor({ color: "#0891b2" });

  await arm();
}

// (Re)arms the loop: next wake at the soonest job, capped at 1s granularity.
async function arm() {
  clearTimeout(timer);
  const jobs = await getJobs();
  const list = Object.values(jobs);
  if (!list.length) {
    chrome.alarms.clear("pp-recover");
    return;
  }
  // recovery alarm in case the worker is killed between ticks
  chrome.alarms.create("pp-recover", { periodInMinutes: 1 });
  timer = setTimeout(tick, 1000);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pp-recover") tick();
});
chrome.runtime.onStartup.addListener(() => tick());
chrome.runtime.onInstalled.addListener(() => tick());

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const jobs = await getJobs();
  if (jobs[tabId]) {
    delete jobs[tabId];
    await chrome.storage.local.set({ jobs });
    await arm();
  }
});

// ---- monitor (Pro): grab page text after reload, diff, notify -------------
function grabText() {
  return (document.body && document.body.innerText ? document.body.innerText : "").slice(0, 500000);
}

function scheduleMonitorCheck(job) {
  // let the page render before reading it
  setTimeout(() => monitorCheck(job.tabId).catch(() => {}), 2500);
}

async function monitorCheck(tabId) {
  const jobs = await getJobs();
  const job = jobs[tabId];
  if (!job || !job.monitor || !job.monitor.enabled) return;
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: grabText });
  const text = res && typeof res.result === "string" ? res.result : "";
  const diff = T.monitorDiff(job.monitor.last || null, text, job.monitor.keyword);
  const fire =
    (job.monitor.keyword && (diff.keywordAppeared || diff.keywordGone)) ||
    (!job.monitor.keyword && diff.changed);
  job.monitor.last = { hash: diff.hash, hasKeyword: diff.hasKeyword };
  await chrome.storage.local.set({ jobs });
  if (fire) {
    const what = diff.keywordAppeared
      ? `"${job.monitor.keyword}" appeared`
      : diff.keywordGone
        ? `"${job.monitor.keyword}" disappeared`
        : "content changed";
    chrome.notifications.create(`pp-${tabId}-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "PagePulse",
      message: `${job.host || "Page"}: ${what}`
    });
  }
}

// ---- popup API ------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  const respond = (p) =>
    p
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));

  if (msg.type === "get-jobs") {
    respond(getJobs().then((jobs) => ({ jobs })));
    return true;
  }
  if (msg.type === "start") {
    respond(
      getJobs().then(async (jobs) => {
        jobs[msg.tabId] = {
          tabId: msg.tabId,
          host: msg.host || "",
          intervalSec: msg.intervalSec,
          jitterPct: msg.jitterPct || 0,
          hardReload: !!msg.hardReload,
          monitor: msg.monitor || null,
          startedAt: Date.now(),
          reloads: 0,
          nextAt: Date.now() + msg.intervalSec * 1000
        };
        await setJobs(jobs);
        return { jobs };
      })
    );
    return true;
  }
  if (msg.type === "stop") {
    respond(
      getJobs().then(async (jobs) => {
        delete jobs[msg.tabId];
        await setJobs(jobs);
        chrome.action.setBadgeText({ tabId: msg.tabId, text: "" }).catch(() => {});
        return { jobs };
      })
    );
    return true;
  }
  if (msg.type === "stop-all") {
    respond(
      getJobs().then(async (jobs) => {
        for (const id of Object.keys(jobs)) chrome.action.setBadgeText({ tabId: Number(id), text: "" }).catch(() => {});
        await setJobs({});
        return { jobs: {} };
      })
    );
    return true;
  }
});
