#!/usr/bin/env node
// Chrome Web Store submission-readiness validator.
// Inspects every product's release/*.zip + store/listing.md and flags anything
// that would bounce a manual submission (bad manifest, missing icons, oversized
// name/description, stray build artifacts, missing privacy answers).
// Usage: node scripts/check-release.mjs [product]
// Exit code is non-zero if any product has a FAIL.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const productsDir = path.join(root, "products");

// Chrome Web Store limits (conservative).
const NAME_MAX = 45; // manifest "name" — store allows more but 45 keeps the card clean
const DESC_MAX = 132; // manifest "description" == store summary
const REQUIRED_ICONS = ["16", "48", "128"];

const only = process.argv[2];
const products = fs
  .readdirSync(productsDir)
  .filter((d) => fs.statSync(path.join(productsDir, d)).isDirectory())
  .filter((d) => !only || d === only)
  .sort();

let hadFail = false;

function zipList(zip) {
  return execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n").filter(Boolean);
}
function zipRead(zip, entry) {
  return execFileSync("unzip", ["-p", zip, entry], { encoding: "utf8" });
}

for (const name of products) {
  const dir = path.join(productsDir, name);
  const relDir = path.join(dir, "release");
  const problems = [];
  const warns = [];

  const zips = fs.existsSync(relDir) ? fs.readdirSync(relDir).filter((f) => f.endsWith(".zip")) : [];
  if (zips.length === 0) {
    console.log(`\n■ ${name}\n  FAIL: no release/*.zip (run npm run build && cp dist/*.zip release/)`);
    hadFail = true;
    continue;
  }
  // newest by version-ish name
  const zip = path.join(relDir, zips.sort().reverse()[0]);
  const entries = zipList(zip);

  // manifest
  let manifest;
  try {
    manifest = JSON.parse(zipRead(zip, "manifest.json"));
  } catch {
    problems.push("manifest.json missing or invalid JSON");
  }

  if (manifest) {
    if (manifest.manifest_version !== 3) problems.push(`manifest_version is ${manifest.manifest_version}, expected 3`);
    if (!manifest.name) problems.push("manifest.name missing");
    else if (manifest.name.length > NAME_MAX) warns.push(`name ${manifest.name.length} chars > ${NAME_MAX} (store card may truncate)`);
    if (!manifest.description) problems.push("manifest.description missing");
    else if (manifest.description.length > DESC_MAX) problems.push(`description ${manifest.description.length} chars > ${DESC_MAX} (store rejects)`);
    if (!/^\d+\.\d+(\.\d+)?(\.\d+)?$/.test(manifest.version || "")) problems.push(`version "${manifest.version}" not a valid dotted number`);

    // icons declared must exist in the zip
    const iconVals = new Set([...Object.values(manifest.icons || {}), ...Object.values((manifest.action && manifest.action.default_icon) || {})]);
    for (const size of REQUIRED_ICONS) {
      const declared = (manifest.icons || {})[size];
      if (!declared) problems.push(`icons["${size}"] not declared`);
      else if (!entries.includes(declared)) problems.push(`icon file "${declared}" declared but not in zip`);
    }
    for (const p of iconVals) if (p && !entries.includes(p)) problems.push(`icon "${p}" referenced but missing from zip`);

    // service worker present if declared
    const sw = manifest.background && manifest.background.service_worker;
    if (sw && !entries.includes(sw)) problems.push(`service_worker "${sw}" missing from zip`);

    // broad host permission → will hit the slower review lane (warn, not fail)
    const hosts = [...(manifest.host_permissions || []), ...((manifest.content_scripts || []).flatMap((c) => c.matches || []))];
    if (hosts.some((h) => h === "<all_urls>" || /:\/\/\*\//.test(h))) {
      warns.push("broad host match (<all_urls>) — expect the in-depth review lane; justification must be in listing.md");
    }
  }

  // stray build artifacts inside the zip
  const stray = entries.filter((e) => e.includes("node_modules/") || e.startsWith("dist/") || e.endsWith(".map") || e.includes("/.DS_Store") || e === ".DS_Store");
  if (stray.length) problems.push(`stray files in zip: ${stray.slice(0, 4).join(", ")}${stray.length > 4 ? "…" : ""}`);

  // listing.md sanity — the review-critical bits
  const listing = path.join(dir, "store", "listing.md");
  if (!fs.existsSync(listing)) {
    problems.push("store/listing.md missing");
  } else {
    const md = fs.readFileSync(listing, "utf8").toLowerCase();
    if (!md.includes("single purpose")) warns.push("listing.md: no 'single purpose' description (Privacy tab requires it)");
    if (!md.includes("privacy") || !md.includes("justif")) warns.push("listing.md: permission justifications not clearly present");
    if (!md.includes("remote code")) warns.push("listing.md: no explicit 'remote code' answer");
    if (!md.includes("privacy.html")) warns.push("listing.md: no privacy policy URL");
  }

  // screenshots present (store requires ≥1; we ship 4 at 1280x800)
  const shotsDir = path.join(dir, "store", "screenshots");
  const shots = fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir).filter((f) => /^\d.*\.png$/.test(f)) : [];
  if (shots.length === 0) problems.push("no numbered store screenshots in store/screenshots/");

  const status = problems.length ? "FAIL" : warns.length ? "PASS (warnings)" : "PASS";
  if (problems.length) hadFail = true;
  console.log(`\n■ ${name} — ${status}`);
  console.log(`  zip: ${path.basename(zip)} · ${entries.length} files · v${manifest ? manifest.version : "?"} · ${shots.length} screenshots`);
  if (manifest) console.log(`  name: "${manifest.name}" (${(manifest.name || "").length}) · summary ${manifest.description ? manifest.description.length : 0}/${DESC_MAX} · perms [${(manifest.permissions || []).join(", ")}]`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  for (const w of warns) console.log(`  ⚠ ${w}`);
}

console.log(`\n${hadFail ? "✗ some products need fixes before submission" : "✓ all products are submission-ready (warnings are informational)"}`);
process.exit(hadFail ? 1 : 0);
