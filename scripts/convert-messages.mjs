// Converts the iOS string catalogue into next-intl messages. Deterministic: same input, same output.
//
//   node scripts/convert-messages.mjs [path/to/Localizable.xcstrings]
//
// Default input: ../.reference/ios/Invest.AO/Resources/Localizable.xcstrings
// Output: messages/pt.json, messages/en.json (nested by the dotted key) and messages/key-map.json,
// which records every iOS key that was renamed or dropped.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.resolve(
  ROOT,
  process.argv[2] ?? "../.reference/ios/Invest.AO/Resources/Localizable.xcstrings",
);
const LANGUAGES = ["pt", "en"];
const FORMAT = /%(?:(\d+)\$)?(?:lld|llu|ld|lu|zd|zu|@|d|i|u|f|s)/g;
const DOTTED = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9-]+)+$/;

const catalogue = JSON.parse(await readFile(SOURCE, "utf8"));
const strings = catalogue.strings;

/** `%@`, `%lld` and positional `%2$@` become `{arg1}`, `{arg2}`; voice tokens like `{issuer}` stay arguments. */
function toIcu(value) {
  let next = 0;
  let last = 0;
  const pieces = [];
  const token = /%%|%(?:(\d+)\$)?(?:lld|llu|ld|lu|zd|zu|@|d|i|u|f|s)|\{([A-Za-z_][A-Za-z0-9_]*)\}|[{}]|'/g;
  for (const match of value.matchAll(token)) {
    pieces.push(value.slice(last, match.index));
    const [text, position, voice] = match;
    if (text === "%%") pieces.push("%");
    else if (text === "'") pieces.push("''");
    else if (text === "{" || text === "}") pieces.push(`'${text}'`);
    else if (voice) pieces.push(`{${voice}}`);
    else pieces.push(`{arg${position ?? ++next}}`);
    last = match.index + text.length;
  }
  pieces.push(value.slice(last));
  return pieces.join("");
}

function camel(words) {
  return words
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join("");
}

function legacyName(sentence) {
  const words = sentence
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(FORMAT, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 6);
  return camel(words.length > 0 ? words : ["text"]);
}

const keyMap = { renamed: {}, dropped: {} };
const entries = []; // [webKey, iosKey]
const taken = new Set();

const iosKeys = Object.keys(strings).sort();
const bases = new Set(iosKeys.filter((key) => DOTTED.test(key.split(" ")[0])).map((key) => key.split(" ")[0]));

for (const iosKey of iosKeys) {
  const base = iosKey.split(" ")[0];
  if (DOTTED.test(base)) {
    // A key that is also a prefix of other keys cannot be a leaf in nested messages.
    const isPrefix = [...bases].some((other) => other.startsWith(`${base}.`));
    const webKey = isPrefix ? `${base}.label` : base;
    if (webKey !== iosKey) keyMap.renamed[iosKey] = webKey;
    entries.push([webKey, iosKey]);
    taken.add(webKey);
    continue;
  }
  if (!/\p{L}/u.test(iosKey.replace(FORMAT, ""))) {
    keyMap.dropped[iosKey] = "format-only; compose on the web";
    continue;
  }
  let webKey = `legacy.${legacyName(iosKey)}`;
  for (let suffix = 2; taken.has(webKey); suffix += 1) webKey = `legacy.${legacyName(iosKey)}${suffix}`;
  taken.add(webKey);
  keyMap.renamed[iosKey] = webKey;
  entries.push([webKey, iosKey]);
}

function setNested(target, dotted, value) {
  const parts = dotted.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    node[part] ??= {};
    if (typeof node[part] !== "object") throw new Error(`Key conflict at ${dotted}`);
    node = node[part];
  }
  if (parts.at(-1) in node) throw new Error(`Duplicate key ${dotted}`);
  node[parts.at(-1)] = value;
}

const messages = Object.fromEntries(LANGUAGES.map((language) => [language, {}]));
for (const [webKey, iosKey] of entries) {
  const localizations = strings[iosKey].localizations ?? {};
  for (const language of LANGUAGES) {
    // iOS falls back to the key itself when a language has no value.
    const value = localizations[language]?.stringUnit?.value ?? localizations.pt?.stringUnit?.value ?? iosKey;
    setNested(messages[language], webKey, toIcu(value));
  }
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
for (const language of LANGUAGES) {
  await writeFile(path.join(ROOT, "messages", `${language}.json`), json(messages[language]));
}
await writeFile(path.join(ROOT, "messages", "key-map.json"), json(keyMap));
console.log(
  `Converted ${entries.length} keys (${Object.keys(keyMap.renamed).length} renamed, ${Object.keys(keyMap.dropped).length} dropped).`,
);
