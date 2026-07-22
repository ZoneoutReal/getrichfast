// Tiny argv parser shared by the scout/scoreboard CLIs.
// Flags: --json, --help/-h (booleans); --out DIR, --date YYYY-MM-DD (values).
// Everything else is a positional (opts._). Value flags consume the next token,
// so a positional input file is never mistaken for a flag value.
export function parseArgs(argv, valueFlags = ["--out", "--date"]) {
  const opts = { json: false, help: false, out: null, date: null, _: [], unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (valueFlags.includes(a)) opts[a.slice(2)] = argv[++i] ?? null;
    else if (a.startsWith("-")) opts.unknown.push(a);
    else opts._.push(a);
  }
  return opts;
}
