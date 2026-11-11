/*
 * The editorial Markdown subset (iOS `NewsMarkdown`): headings, paragraphs, quotes, bullets,
 * numbered items and rules as blocks; bold, italic and links inline. Nothing else is interpreted,
 * HTML included, and only http(s) links with a host and no credentials are ever rendered as links.
 */

export type MarkdownBlockKind =
  | { readonly type: "heading"; readonly level: number }
  | { readonly type: "paragraph" }
  | { readonly type: "quote" }
  | { readonly type: "bullet" }
  | { readonly type: "numbered"; readonly number: number }
  | { readonly type: "rule" };

export type MarkdownBlock = { readonly id: number; readonly kind: MarkdownBlockKind; readonly text: string };

const NEWLINES = /\r\n|[\n\r\u000b\u000c\u0085\u2028\u2029]/;
const NUMBERED = /^(\d+)[.)]\s+/;

export function markdownBlocks(markdown: string): MarkdownBlock[] {
  const result: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  const append = (kind: MarkdownBlockKind, text: string) => result.push({ id: result.length, kind, text });
  const flush = () => {
    if (paragraph.length === 0) return;
    append({ type: "paragraph" }, paragraph.join(" "));
    paragraph = [];
  };
  for (const raw of markdown.split(NEWLINES)) {
    const line = raw.replace(/^[ \t]+|[ \t]+$/g, "");
    if (line === "") {
      flush();
      continue;
    }
    if (line === "---" || line === "***" || line === "___") {
      flush();
      append({ type: "rule" }, "");
      continue;
    }
    const hashes = /^#*/.exec(line)![0].length;
    if (hashes >= 1 && hashes <= 6 && line[hashes] === " ") {
      flush();
      append({ type: "heading", level: hashes }, line.slice(hashes + 1));
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      append({ type: "quote" }, line.slice(1).replace(/^[ \t]+|[ \t]+$/g, ""));
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("+ ")) {
      flush();
      append({ type: "bullet" }, line.slice(2));
      continue;
    }
    const numbered = NUMBERED.exec(line);
    if (numbered) {
      flush();
      append({ type: "numbered", number: Number.parseInt(numbered[1], 10) || 1 }, line.slice(numbered[0].length));
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return result;
}

/** `http`/`https` with a host and no user or password; everything else (javascript:, data:, file:, protocol-relative) is refused. */
export function safeURL(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (url.hostname === "" || url.username !== "" || url.password !== "") return undefined;
  return url.href;
}

export type InlineRun = { readonly text: string; readonly strong?: true; readonly emphasis?: true; readonly href?: string };

type Style = { strong?: true; emphasis?: true; href?: string };

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!>~|]/;
const isWord = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

function closing(text: string, from: number, delimiter: string): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] === "\\") {
      index += 1;
      continue;
    }
    if (!text.startsWith(delimiter, index)) continue;
    if (delimiter.length === 1 && text[index + 1] === delimiter) {
      index += 1;
      continue;
    }
    if (index === from || /\s/.test(text[index - 1])) continue;
    if (delimiter[0] === "_" && isWord(text[index + delimiter.length])) continue;
    return index;
  }
  return -1;
}

/** End of a `[label](url)` starting at `start`, with its parts; undefined when it is not a link. */
function link(text: string, start: number): { label: string; url: string; end: number } | undefined {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "[") depth += 1;
    else if (char === "]" && --depth === 0) {
      if (text[index + 1] !== "(") return undefined;
      // The destination may hold balanced parentheses, as in CommonMark: `(javascript:alert(1))`.
      let close = -1;
      for (let at = index + 2, open = 1; at < text.length; at += 1) {
        if (text[at] === "\\") at += 1;
        else if (text[at] === "(") open += 1;
        else if (text[at] === ")" && --open === 0) {
          close = at;
          break;
        }
      }
      if (close < 0) return undefined;
      const url = text.slice(index + 2, close).trim().split(/\s+/)[0] ?? "";
      return { label: text.slice(start + 1, index), url: url.replace(/^<|>$/g, ""), end: close + 1 };
    }
  }
  return undefined;
}

function parse(text: string, style: Style, runs: InlineRun[]): void {
  let buffer = "";
  const push = (value: string, runStyle: Style = style) => {
    if (value === "") return;
    const last = runs.at(-1);
    if (last && last.strong === runStyle.strong && last.emphasis === runStyle.emphasis && last.href === runStyle.href) {
      runs[runs.length - 1] = { ...last, text: last.text + value };
    } else runs.push({ text: value, ...runStyle });
  };
  const flush = () => {
    push(buffer);
    buffer = "";
  };
  for (let index = 0; index < text.length; ) {
    const char = text[index];
    if (char === "\\" && ESCAPABLE.test(text[index + 1] ?? "")) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }
    if (char === "[") {
      const found = link(text, index);
      if (found) {
        flush();
        // An unsafe destination keeps its label as plain text.
        const href = style.href ?? safeURL(found.url);
        parse(found.label, href ? { ...style, href } : style, runs);
        index = found.end;
        continue;
      }
    }
    if (char === "*" || char === "_") {
      const double = text[index + 1] === char;
      const delimiter = double ? char + char : char;
      const opensWord = char === "_" && isWord(text[index - 1]);
      const next = text[index + delimiter.length];
      if (!opensWord && next !== undefined && !/\s/.test(next)) {
        const end = closing(text, index + delimiter.length, delimiter);
        if (end > index + delimiter.length) {
          flush();
          parse(text.slice(index + delimiter.length, end), double ? { ...style, strong: true } : { ...style, emphasis: true }, runs);
          index = end + delimiter.length;
          continue;
        }
      }
    }
    buffer += char;
    index += 1;
  }
  flush();
}

/** Inline runs of one block: bold, italic and safe links; any other markup stays literal text. */
export function inlineRuns(markdown: string): InlineRun[] {
  const runs: InlineRun[] = [];
  parse(markdown, {}, runs);
  return runs;
}

/** The text a reader sees, without markup. */
export const plainText = (markdown: string) =>
  inlineRuns(markdown)
    .map((run) => run.text)
    .join("");
