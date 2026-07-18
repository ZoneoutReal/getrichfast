// Recall indexing-engine tests: the pure RecallIndex module imported straight
// into Node (it guards globalThis, so importing executes the IIFE and
// populates globalThis.RecallIndex). Usage: npm run test:logic
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, "..", "extension", "src", "lib", "index.js")).href);
const RI = globalThis.RecallIndex;

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

check("module imported into Node", !!RI && typeof RI.addDoc === "function");

// ---- tokenization / stopwords ---------------------------------------------
check("tokenize lowercases & splits on non-word", JSON.stringify(RI.tokenize("The Quick, BROWN fox!")) === JSON.stringify(["quick", "brown", "fox"]), JSON.stringify(RI.tokenize("The Quick, BROWN fox!")));
check("tokenize drops stopwords (the/of/and)", RI.tokenize("the cat and the hat of doom").join(",") === "cat,hat,doom", RI.tokenize("the cat and the hat of doom").join(","));
check("tokenize drops single-char noise", RI.tokenize("a x ai go9").join(",") === "ai,go9", RI.tokenize("a x ai go9").join(","));
check("tokenize keeps repeats for term frequency", RI.tokenize("hello hello world").length === 3);
const tf = RI.termFreqs(RI.tokenize("cat cat cat dog"));
check("termFreqs counts occurrences", tf.get("cat") === 3 && tf.get("dog") === 1, JSON.stringify([...tf]));
check("tokenize handles empty/nullish", RI.tokenize("").length === 0 && RI.tokenize(null).length === 0);

// ---- add / update docs & the docs map -------------------------------------
const idx = RI.emptyIndex();
const idA = RI.addDoc(idx, { url: "https://www.example.com/a?x=1#frag", title: "Espresso Guide", description: "on coffee", body: "espresso grinder barista acidity espresso", visitedAt: 1000 });
check("addDoc returns a docId", !!idA);
const docA = idx.docs[idA];
check("doc stores url (fragment stripped)", docA.url === "https://www.example.com/a?x=1");
check("doc stores host without www", docA.host === "example.com", docA.host);
check("doc stores title", docA.title === "Espresso Guide");
check("doc stores a snippet excerpt", typeof docA.snippet === "string" && docA.snippet.includes("espresso"));
check("doc stores visitedAt", docA.visitedAt === 1000);

// ---- inverted index correctness -------------------------------------------
// "espresso" appears once in the title + twice in the body → tf 3 (title, meta
// and body are all indexed together).
check("inverted index maps token → {docId → tf}", idx.inv["espresso"][idA] === 3, JSON.stringify(idx.inv["espresso"]));
check("token appearing once has tf 1", idx.inv["grinder"][idA] === 1);
check("one posting per doc per token (deduped)", Object.keys(idx.inv["espresso"]).length === 1);
check("stopwords never enter the index", !("on" in idx.inv), Object.keys(idx.inv).join(","));

// second doc
const idB = RI.addDoc(idx, { url: "https://blog.test.org/b", title: "Weekend Reading", body: "photosynthesis chlorophyll sunlight oxygen leaves", visitedAt: 2000 });
check("second doc indexed separately", RI.docCount(idx) === 2);
check("token unique to doc B only lists doc B", JSON.stringify(Object.keys(idx.inv["photosynthesis"])) === JSON.stringify([idB]));

// ---- search: basic retrieval ----------------------------------------------
check("search returns a doc containing the query term", RI.search(idx, "photosynthesis").some((r) => r.docId === idB));
const bodyHit = RI.search(idx, "photosynthesis")[0];
check("search matches BODY content (word not in title)", bodyHit && bodyHit.docId === idB && !idx.docs[idB].title.toLowerCase().includes("photosynthesis"));
check("search matches a TITLE word too", RI.search(idx, "weekend").some((r) => r.docId === idB));
check("made-up word returns nothing", RI.search(idx, "zxqwvfoobar").length === 0);
check("query of only stopwords returns nothing", RI.search(idx, "the and of").length === 0);

// ---- ranking ---------------------------------------------------------------
{
  const r = RI.emptyIndex();
  const many = RI.addDoc(r, { url: "https://x.com/1", title: "t1", body: "quantum quantum quantum computing", visitedAt: 10 });
  const few = RI.addDoc(r, { url: "https://x.com/2", title: "t2", body: "a quantum note", visitedAt: 20 });
  const top = RI.search(r, "quantum");
  check("higher term-frequency ranks first", top[0].docId === many, JSON.stringify(top.map((x) => x.docId)));
  check("both docs returned for the term", top.length === 2);
}
{
  const r = RI.emptyIndex();
  const one = RI.addDoc(r, { url: "https://y.com/1", title: "t1", body: "coffee coffee coffee beans roast", visitedAt: 10 });
  const two = RI.addDoc(r, { url: "https://y.com/2", title: "t2", body: "coffee and tea pairing", visitedAt: 20 });
  const res = RI.search(r, "coffee tea");
  check("multi-term AND-ish: doc matching both terms ranks first", res[0].docId === two, JSON.stringify(res.map((x) => ({ id: x.docId, m: x.matched }))));
  check("matched-term count is tracked", res[0].matched === 2 && res[1].matched === 1);
}

// ---- re-visit updates in place (no duplicates) ----------------------------
{
  const r = RI.emptyIndex();
  const id1 = RI.addDoc(r, { url: "https://z.com/p", title: "First", body: "alpha beta gamma", visitedAt: 100 });
  const id2 = RI.addDoc(r, { url: "https://z.com/p", title: "Second", body: "delta epsilon", visitedAt: 200 });
  check("re-visiting a URL keeps the same docId", id1 === id2);
  check("re-visit does not create a duplicate doc", RI.docCount(r) === 1);
  check("re-visit updates title/content", r.docs[id2].title === "Second" && r.docs[id2].visitedAt === 200);
  check("re-visit purges stale tokens from the index", !("alpha" in r.inv) && "delta" in r.inv, Object.keys(r.inv).join(","));
}

// ---- pruning (bounded storage) --------------------------------------------
{
  const now = 1_000_000_000_000;
  const DAY = RI.DAY_MS;
  const r = RI.emptyIndex();
  RI.addDoc(r, { url: "https://p.com/old", title: "t", body: "keyword antique", visitedAt: now - 30 * DAY });
  RI.addDoc(r, { url: "https://p.com/mid", title: "t", body: "keyword medium", visitedAt: now - 10 * DAY });
  RI.addDoc(r, { url: "https://p.com/new", title: "t", body: "keyword recent", visitedAt: now - 1 * DAY });
  const removed = RI.prune(r, { retentionDays: 14, now });
  check("retention prune evicts docs older than the window", removed === 1 && RI.docCount(r) === 2);
  check("retention prune keeps in-window docs", !!r.ids["https://p.com/mid"] && !!r.ids["https://p.com/new"]);
  check("retention prune cleans the inverted index", !("antique" in r.inv) && "recent" in r.inv, Object.keys(r.inv).join(","));
}
{
  const r = RI.emptyIndex();
  for (let i = 0; i < 6; i++) RI.addDoc(r, { url: `https://c.com/${i}`, title: `t${i}`, body: `word doc${i}`, visitedAt: 1000 + i * 1000 });
  const removed = RI.prune(r, { maxDocs: 3 });
  check("maxDocs prune trims down to the cap", removed === 3 && RI.docCount(r) === 3);
  const kept = Object.values(r.docs).map((d) => d.visitedAt).sort((a, b) => a - b);
  check("maxDocs prune evicts the OLDEST, keeps newest", JSON.stringify(kept) === JSON.stringify([4000, 5000, 6000]), JSON.stringify(kept));
}
{
  const r = RI.emptyIndex();
  RI.addDoc(r, { url: "https://u.com/1", title: "t", body: "word one", visitedAt: 1 });
  const before = RI.docCount(r);
  RI.prune(r, { maxDocs: Infinity, retentionDays: Infinity });
  check("Pro (unlimited) prune removes nothing", RI.docCount(r) === before);
}

// ---- snippet generation ----------------------------------------------------
{
  const src = "Photosynthesis converts sunlight into chemical energy inside the chloroplasts of plant cells during the day.";
  const snip = RI.makeSnippet(src, ["chloroplasts"]);
  check("snippet windows around the matched term", snip.toLowerCase().includes("chloroplasts"), snip);
  const idxs = RI.emptyIndex();
  const sid = RI.addDoc(idxs, { url: "https://s.com/x", title: "Notes", body: src, visitedAt: 5 });
  const sr = RI.search(idxs, "chloroplasts")[0];
  check("search attaches a highlightable snippet", sr && sr.snippet.toLowerCase().includes("chloroplasts"), sr && sr.snippet);
  const fallback = RI.makeSnippet(src, ["nowheretobefound"]);
  check("snippet falls back to excerpt start when no match", fallback.startsWith("Photosynthesis"), fallback);
}

// ---- URL policy (shared with content script) ------------------------------
check("isHttpUrl accepts http(s)", RI.isHttpUrl("https://a.com") && RI.isHttpUrl("http://a.com") && !RI.isHttpUrl("ftp://a.com") && !RI.isHttpUrl("chrome://x"));
check("isSensitiveUrl flags auth/checkout paths", RI.isSensitiveUrl("https://shop.com/checkout") && RI.isSensitiveUrl("https://x.com/login") && RI.isSensitiveUrl("https://x.com/a?token=abc"));
check("isSensitiveUrl flags login./bank. subdomains", RI.isSensitiveUrl("https://login.example.com/") && RI.isSensitiveUrl("https://secure.bank.com/home"));
check("isSensitiveUrl leaves normal article URLs alone", !RI.isSensitiveUrl("https://news.com/2024/quantum-computing-explained"));
check("isIndexableUrl = http(s) AND not sensitive", RI.isIndexableUrl("https://news.com/story") && !RI.isIndexableUrl("https://news.com/account/settings") && !RI.isIndexableUrl("chrome://newtab"));

// ---- timeAgo ---------------------------------------------------------------
{
  const now = 1_700_000_000_000;
  check("timeAgo: seconds → just now", RI.timeAgo(now - 20_000, now) === "just now");
  check("timeAgo: minutes", RI.timeAgo(now - 5 * 60_000, now) === "5m ago");
  check("timeAgo: hours", RI.timeAgo(now - 3 * 3_600_000, now) === "3h ago");
  check("timeAgo: days", RI.timeAgo(now - 2 * 86_400_000, now) === "2d ago");
}

// ---- stats & hosts ---------------------------------------------------------
check("stats reports doc & token counts", (() => { const s = RI.stats(idx); return s.docs === 2 && s.tokens > 0; })());
check("hosts lists unique sorted hosts", JSON.stringify(RI.hosts(idx)) === JSON.stringify(["blog.test.org", "example.com"]), JSON.stringify(RI.hosts(idx)));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
