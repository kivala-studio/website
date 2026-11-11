import type { ReactNode } from "react";

import { type MarkdownBlock, inlineRuns, markdownBlocks } from "@/domain/news/markdown";

/** Inline runs as React nodes. Links exist only for safe `http(s)` URLs; anything else is already plain text. */
function Inline({ text }: { text: string }) {
  return inlineRuns(text).map((run, index) => {
    let node: ReactNode = run.text;
    if (run.emphasis) node = <em>{node}</em>;
    if (run.strong) node = <strong className="font-semibold">{node}</strong>;
    if (run.href) {
      node = (
        <a href={run.href} rel="noopener noreferrer nofollow external" target="_blank" className="font-medium text-accent underline underline-offset-4">
          {node}
        </a>
      );
    }
    return <span key={index}>{node}</span>;
  });
}

type Group = { kind: "bullet" | "numbered"; blocks: MarkdownBlock[] } | { kind: "single"; block: MarkdownBlock };

function grouped(blocks: readonly MarkdownBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    const list = block.kind.type === "bullet" || block.kind.type === "numbered" ? block.kind.type : undefined;
    const last = groups.at(-1);
    if (list && last && last.kind === list) last.blocks.push(block);
    else if (list) groups.push({ kind: list, blocks: [block] });
    else groups.push({ kind: "single", block });
  }
  return groups;
}

function Block({ block }: { block: MarkdownBlock }) {
  const kind = block.kind;
  switch (kind.type) {
    case "rule":
      return <hr className="border-separator" />;
    case "heading":
      return kind.level <= 2 ? (
        <h2 className="text-section text-primary-text">
          <Inline text={block.text} />
        </h2>
      ) : (
        <h3 className="text-body font-semibold text-primary-text">
          <Inline text={block.text} />
        </h3>
      );
    case "quote":
      return (
        <blockquote className="border-l-3 border-accent pl-3 text-secondary-text">
          <Inline text={block.text} />
        </blockquote>
      );
    default:
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
  }
}

/** The safe Markdown subset of iOS `NewsMarkdownView`: headings, paragraphs, quotes, lists, rules, emphasis and safe links. */
export function NewsMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-4 text-body leading-relaxed text-primary-text">
      {grouped(markdownBlocks(markdown)).map((group, index) =>
        group.kind === "single" ? (
          <Block key={group.block.id} block={group.block} />
        ) : group.kind === "bullet" ? (
          <ul key={`list-${index}`} className="flex list-disc flex-col gap-2 pl-6">
            {group.blocks.map((block) => (
              <li key={block.id}>
                <Inline text={block.text} />
              </li>
            ))}
          </ul>
        ) : (
          <ol
            key={`list-${index}`}
            start={group.blocks[0].kind.type === "numbered" ? group.blocks[0].kind.number : undefined}
            className="flex list-decimal flex-col gap-2 pl-6"
          >
            {group.blocks.map((block) => (
              <li key={block.id} value={block.kind.type === "numbered" ? block.kind.number : undefined}>
                <Inline text={block.text} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
