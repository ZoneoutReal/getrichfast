// ClipStack history-store tests: the pure store lib loaded straight into Node.
// store.js only touches globalThis, so importing it for its side effect gives
// us globalThis.ClipStackStore. Usage: npm run test:logic
import "../extension/src/lib/config.js";
import "../extension/src/lib/store.js";

const S = globalThis.ClipStackStore;

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const clip = (text, host = "example.com") => ({ text, host });

// ---- makeEntry -------------------------------------------------------------
const e1 = S.makeEntry(clip("hello"), 1000);
check("makeEntry defaults: text kind, unpinned, has id", e1.kind === "text" && e1.pinned === false && !!e1.id && e1.at === 1000, JSON.stringify(e1));
check("makeEntry strips www. from host", S.makeEntry({ text: "x", host: "www.foo.com" }).host === "foo.com");

// ---- add / dedupe ----------------------------------------------------------
let list = [];
list = S.add(list, clip("first"), { now: 1 });
list = S.add(list, clip("second"), { now: 2 });
check("add appends distinct clips", list.length === 2, String(list.length));

const before = list.find((e) => e.text === "first");
list = S.add(list, clip("first"), { now: 5 }); // re-copy the same text
check("re-copying the same text does not duplicate", list.length === 2, String(list.length));
const after = list.find((e) => e.text === "first");
check("re-copy bumps the timestamp instead", after.at === 5 && before.at === 1, `${before.at}→${after.at}`);
check("re-copy moves the clip to the top", S.ordered(list)[0].text === "first", JSON.stringify(S.ordered(list).map((e) => e.text)));

list = S.add(list, clip("  first   "), { now: 8 }); // whitespace variant
check("dedupe normalizes whitespace", list.length === 2, String(list.length));

check("empty text is ignored", S.add([], clip("   "), { now: 1 }).length === 0);
check("isAcceptable rejects blank, accepts text", S.isAcceptable(clip("")) === false && S.isAcceptable(clip("hi")) === true);
check(
  "isAcceptable enforces the image size cap",
  S.isAcceptable({ kind: "image", image: "data:image/png;base64,AAAA" }) === true &&
    S.isAcceptable({ kind: "image", image: "data:image/png;base64," + "A".repeat(S.MAX_IMAGE_BYTES + 10) }) === false
);

// ---- cap eviction (free) ---------------------------------------------------
let big = [];
for (let i = 1; i <= 55; i++) big = S.add(big, clip("item-" + i), { now: i, max: 50 });
check("free cap evicts down to max (50)", big.length === 50, String(big.length));
check("eviction drops the OLDEST unpinned", !big.some((e) => e.text === "item-1") && big.some((e) => e.text === "item-55"), "oldest should be gone, newest kept");

// ---- pinned survive eviction ----------------------------------------------
let pinnedCase = S.add([], clip("KEEP ME"), { now: 1, max: 50 });
pinnedCase = S.togglePin(pinnedCase, pinnedCase[0].id); // pin the oldest
for (let i = 2; i <= 61; i++) pinnedCase = S.add(pinnedCase, clip("junk-" + i), { now: i, max: 50 });
const kept = pinnedCase.find((e) => e.text === "KEEP ME");
check("pinned clip survives a flood of new copies", !!kept && kept.pinned === true);
check("unpinned stays capped while pinned is extra", S.counts(pinnedCase).unpinned === 50 && S.counts(pinnedCase).pinned === 1, JSON.stringify(S.counts(pinnedCase)));

// ---- free vs pro cap -------------------------------------------------------
let proList = [];
for (let i = 1; i <= 55; i++) proList = S.add(proList, clip("p-" + i), { now: i, isPro: true });
check("Pro keeps unlimited history (no eviction)", proList.length === 55, String(proList.length));
let capped = [];
for (let i = 1; i <= 10; i++) capped = S.add(capped, clip("c-" + i), { now: i, max: 3 });
check("explicit max overrides pro/free default", capped.length === 3, String(capped.length));

// ---- pin/unpin + ordering --------------------------------------------------
let ord = [];
ord = S.add(ord, clip("A"), { now: 1 });
ord = S.add(ord, clip("B"), { now: 2 });
ord = S.add(ord, clip("C"), { now: 3 });
const aId = ord.find((e) => e.text === "A").id;
ord = S.setPinned(ord, aId, true);
const orderedTexts = S.ordered(ord).map((e) => e.text);
check("pinned clips sort to the top", orderedTexts[0] === "A", JSON.stringify(orderedTexts));
check("unpinned still sort by recency under pins", orderedTexts[1] === "C" && orderedTexts[2] === "B", JSON.stringify(orderedTexts));
ord = S.togglePin(ord, aId);
check("togglePin unpins", ord.find((e) => e.text === "A").pinned === false);
check("after unpin, order is pure recency", S.ordered(ord).map((e) => e.text).join("") === "CBA", JSON.stringify(S.ordered(ord).map((e) => e.text)));

// two pinned sort by recency among themselves
let two = S.add(S.add(S.add([], clip("old"), { now: 1 }), clip("mid"), { now: 2 }), clip("new"), { now: 3 });
two = S.setPinned(two, two.find((e) => e.text === "old").id, true);
two = S.setPinned(two, two.find((e) => e.text === "new").id, true);
check("multiple pins sort by recency among pinned", S.ordered(two).map((e) => e.text).join(",") === "new,old,mid", JSON.stringify(S.ordered(two).map((e) => e.text)));

// ---- delete ----------------------------------------------------------------
let del = S.add(S.add([], clip("keep"), { now: 1 }), clip("drop"), { now: 2 });
const dropId = del.find((e) => e.text === "drop").id;
del = S.remove(del, dropId);
check("remove deletes by id", del.length === 1 && del[0].text === "keep", JSON.stringify(del.map((e) => e.text)));

// clearUnpinned keeps pins; clearAll wipes
let mix = S.add(S.add([], clip("pinme"), { now: 1 }), clip("free"), { now: 2 });
mix = S.setPinned(mix, mix.find((e) => e.text === "pinme").id, true);
check("clearUnpinned keeps pinned only", S.clearUnpinned(mix).length === 1 && S.clearUnpinned(mix)[0].text === "pinme");
check("clearAll wipes everything", S.clearAll(mix).length === 0);

// ---- search ----------------------------------------------------------------
let searchList = [];
searchList = S.add(searchList, clip("Tracking number 1Z999AA10123456784", "ups.com"), { now: 1 });
searchList = S.add(searchList, clip("const sum = (a, b) => a + b;", "github.com"), { now: 2 });
searchList = S.add(searchList, clip("221B Baker Street, London", "maps.example"), { now: 3 });
check("search matches text (case-insensitive)", S.search(searchList, "TRACKING").length === 1);
check("search matches host", S.search(searchList, "github").length === 1);
check("search with no query returns all", S.search(searchList, "").length === 3);
check("search miss returns none", S.search(searchList, "zzz-nope").length === 0);

// ---- counts / timeAgo / preview / export ----------------------------------
const cnt = S.counts(mix);
check("counts reports total/pinned/unpinned", cnt.total === 2 && cnt.pinned === 1 && cnt.unpinned === 1, JSON.stringify(cnt));
check("timeAgo: fresh copy reads 'just now'", S.timeAgo(1000, 1000) === "just now");
check("timeAgo: minutes then hours", S.timeAgo(0, 5 * 60 * 1000) === "5m" && S.timeAgo(0, 3 * 3600 * 1000) === "3h", `${S.timeAgo(0, 5 * 60 * 1000)} / ${S.timeAgo(0, 3 * 3600 * 1000)}`);
check("preview collapses whitespace + truncates", S.preview("a\n\n   b", 40) === "a b" && S.preview("x".repeat(500)).length <= 220);

const exported = JSON.parse(S.exportJSON(searchList));
check("exportJSON is valid and tagged", exported.app === "clipstack" && Array.isArray(exported.clips) && exported.clips.length === 3, JSON.stringify(exported).slice(0, 60));

// ---- summary ---------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
