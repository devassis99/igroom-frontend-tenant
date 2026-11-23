#!/usr/bin/env node
/**
 * Lists copy that has no translation yet.
 *
 *   node scripts/i18n-missing.mjs          # counts per language
 *   node scripts/i18n-missing.mjs pt-BR    # the missing strings, as JSON to fill in
 *
 * Finds every `t("…")` in src/ (first argument a plain string literal),
 * plus the API's error messages listed in src/i18n/api-messages.json
 * (they reach the screen through ApiError), and checks them against
 * src/i18n/locales/*.json. Also reports keys a dictionary still carries
 * that nothing uses any more.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = path.join(root, "src/i18n/locales");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

const used = new Set();
const callRe = /\bt\(\s*("(?:[^"\\]|\\.)*")/g;
for (const file of walk(path.join(root, "src"))) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(callRe)) used.add(JSON.parse(match[1]));
}

const apiMessages = path.join(root, "src/i18n/api-messages.json");
if (fs.existsSync(apiMessages))
  for (const key of JSON.parse(fs.readFileSync(apiMessages, "utf8"))) used.add(key);

const only = process.argv[2];
for (const file of fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"))) {
  const code = file.replace(/\.json$/, "");
  if (only && only !== code) continue;
  const dict = JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8"));
  const missing = [...used].filter((key) => !dict[key]);
  const unused = Object.keys(dict).filter((key) => !used.has(key));
  if (only) {
    console.log(JSON.stringify(Object.fromEntries(missing.map((key) => [key, ""])), null, 2));
  } else {
    console.log(
      `${code}: ${used.size - missing.length}/${used.size} translated, ${missing.length} missing, ${unused.length} unused`,
    );
  }
}
