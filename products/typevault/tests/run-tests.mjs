// TypeVault logic tests: the pure diff + versioning modules, imported directly
// in Node (each file's IIFE assigns onto globalThis when it loads). Same
// check()/PASS-FAIL/exit-code harness as the rest of the portfolio.
// Usage: npm run test:logic
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Importing for side effects: sets globalThis.TypeVaultDiff / TypeVaultStore.
await import(path.join(here, "..", "extension", "src", "lib", "diff.js"));
await import(path.join(here, "..", "extension", "src", "lib", "store.js"));

const Diff = globalThis.TypeVaultDiff;
const Store = globalThis.TypeVaultStore;

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const sideText = (ops, keep) =>
  ops.filter((o) => o.type === "same" || o.type === keep).map((o) => o.text).join("");

// ============================== diff.js =====================================

check("module: TypeVaultDiff loaded in Node", !!Diff && typeof Diff.diffWords === "function");

// tokenize is lossless
{
  const t = "Hello  world,\n new line";
  check("tokenize round-trips (lossless)", Diff.tokenize(t).join("") === t);
  check("tokenize empty → []", Diff.tokenize("").length === 0);
}

// identical text
{
  const ops = Diff.diffWords("the quick brown fox", "the quick brown fox");
  check("identical text → only 'same' ops", ops.every((o) => o.type === "same"), JSON.stringify(ops));
  check("identical text → diffStats changed 0", Diff.diffStats(ops).changed === 0);
}

// pure addition (append)
{
  const oldT = "Dear team,";
  const newT = "Dear team, thanks for your patience";
  const ops = Diff.diffWords(oldT, newT);
  check("append → has add, no del", ops.some((o) => o.type === "add") && !ops.some((o) => o.type === "del"));
  check("append → new side reconstructs", sideText(ops, "add") === newT, sideText(ops, "add"));
  check("append → old side reconstructs", sideText(ops, "del") === oldT, sideText(ops, "del"));
}

// pure deletion
{
  const oldT = "please review the attached invoice today";
  const newT = "please review the invoice";
  const ops = Diff.diffWords(oldT, newT);
  check("deletion → has del, no add", ops.some((o) => o.type === "del") && !ops.some((o) => o.type === "add"));
  check("deletion → old side reconstructs", sideText(ops, "del") === oldT);
  check("deletion → new side reconstructs", sideText(ops, "add") === newT);
}

// word replacement
{
  const ops = Diff.diffWords("the meeting is on Monday", "the meeting is on Friday");
  check("replacement → has both add and del", ops.some((o) => o.type === "add") && ops.some((o) => o.type === "del"));
  const s = Diff.diffStats(ops);
  check("replacement → +1 / −1 word", s.added === 1 && s.removed === 1, JSON.stringify(s));
}

// middle insertion + general reconstruction invariant
{
  const oldT = "ship it on time";
  const newT = "ship it safely on time";
  const ops = Diff.diffWords(oldT, newT);
  check("middle insert → both sides reconstruct", sideText(ops, "del") === oldT && sideText(ops, "add") === newT);
}

// empty edges
{
  const ops1 = Diff.diffWords("", "brand new draft");
  check("empty→text is all add", ops1.every((o) => o.type === "add") && sideText(ops1, "add") === "brand new draft");
  const ops2 = Diff.diffWords("was here", "");
  check("text→empty is all del", ops2.every((o) => o.type === "del"));
}

// adjacent ops merged
{
  const ops = Diff.diffWords("a b c d", "a x y d");
  const runs = ops.map((o) => o.type);
  check("no two adjacent ops share a type", runs.every((t, i) => i === 0 || t !== runs[i - 1]), JSON.stringify(runs));
}

// ============================== store.js ====================================

check("module: TypeVaultStore loaded in Node", !!Store && typeof Store.addVersion === "function");

// changedEnough
check("changedEnough: identical → false", Store.changedEnough("hello world here", "hello world here") === false);
check("changedEnough: whitespace-only → false", Store.changedEnough("hello   world", "hello world\n") === false);
check("changedEnough: real edit → true", Store.changedEnough("hello world", "hello there world") === true);
check("changedEnough: empty next → false", Store.changedEnough("something", "   ") === false);
check("changedEnough: from empty prev → true", Store.changedEnough("", "now has content") === true);

// fieldSignature
{
  const a = Store.fieldSignature("https://x.com", "/compose", "textarea|n=body");
  const b = Store.fieldSignature("https://x.com", "/compose", "textarea|n=body");
  const c = Store.fieldSignature("https://x.com", "/other", "textarea|n=body");
  const d = Store.fieldSignature("https://x.com", "/compose", "textarea|n=subject");
  check("fieldSignature: stable for same inputs", a === b, `${a} ${b}`);
  check("fieldSignature: differs by path", a !== c);
  check("fieldSignature: differs by field key", a !== d);
  check("fieldSignature: is a string with prefix", typeof a === "string" && a.startsWith("f_"));
}

// addVersion basics
{
  const field = { versions: [] };
  const r1 = Store.addVersion(field, { text: "the first draft of my message", at: 1000 }, 20);
  check("addVersion: first snapshot added", r1.added === true && field.versions.length === 1);
  check("addVersion: sets len when omitted", field.versions[0].len === "the first draft of my message".length);
  check("addVersion: sets lastEdited", field.lastEdited === 1000);

  const r2 = Store.addVersion(field, { text: "the first draft of my message", at: 2000 }, 20);
  check("addVersion: dedupes identical latest", r2.added === false && field.versions.length === 1);

  const r3 = Store.addVersion(field, { text: "the first draft of my longer message", at: 3000 }, 20);
  check("addVersion: meaningful change added", r3.added === true && field.versions.length === 2);
  check("addVersion: latest() returns newest", Store.latest(field).at === 3000);
}

// cap enforcement
{
  const field = { versions: [] };
  for (let i = 0; i < 30; i++) Store.addVersion(field, { text: "revision number " + i, at: i }, 20);
  check("addVersion: caps versions at cap (20)", field.versions.length === 20, String(field.versions.length));
  check("addVersion: keeps the NEWEST after capping", field.versions[field.versions.length - 1].text === "revision number 29");
  check("addVersion: drops the oldest after capping", field.versions[0].text === "revision number 10");
}

// pruneField
{
  const field = { versions: Array.from({ length: 12 }, (_, i) => ({ text: "v" + i, at: i, len: 2 })) };
  Store.pruneField(field, 5);
  check("pruneField: trims to newest N", field.versions.length === 5 && field.versions[0].text === "v7");
}

// pruneAll
{
  const store = {
    a: { lastEdited: 100, versions: [] },
    b: { lastEdited: 300, versions: [] },
    c: { lastEdited: 200, versions: [] },
    d: { lastEdited: 400, versions: [] }
  };
  Store.pruneAll(store, 2);
  const keys = Object.keys(store).sort();
  check("pruneAll: keeps only maxFields", keys.length === 2, JSON.stringify(keys));
  check("pruneAll: keeps most-recently-edited fields", "b" in store && "d" in store, JSON.stringify(keys));
  check("pruneAll: no-op under budget", (() => { const s = { x: { lastEdited: 1 } }; Store.pruneAll(s, 5); return "x" in s; })());
}

// ============================================================================

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
