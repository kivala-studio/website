import { describe, expect, it } from "vitest";

import { decodeNewsArticle } from "./article";
import { inlineRuns, markdownBlocks, safeURL } from "./markdown";

// Ports NewsMarkdownTests.swift case for case.
describe("news markdown", () => {
  it("supported blocks", () => {
    const blocks = markdownBlocks("# Heading\n\nParagraph **bold**.\nNext line.\n\n- Item\n2. Second\n> Quote\n\n---");
    expect(blocks.map((block) => block.kind)).toEqual([
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "bullet" },
      { type: "numbered", number: 2 },
      { type: "quote" },
      { type: "rule" },
    ]);
    expect(blocks[1].text).toBe("Paragraph **bold**. Next line.");
  });

  it("unsafe links are never interactive", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "//example.com", "https://user:password@example.com"]) {
      expect(safeURL(value), value).toBeUndefined();
    }
    const result = inlineRuns("[unsafe](javascript:alert)");
    expect(result.every((run) => run.href === undefined)).toBe(true);
    expect(safeURL("https://www.bodiva.ao/announcement")).toBeDefined();
  });

  it("inline emphasis and links remain native", () => {
    const result = inlineRuns("**Bold** and *italic* [source](https://example.com)");
    expect(result.map((run) => run.text).join("")).toBe("Bold and italic source");
    expect(result.some((run) => run.href !== undefined && new URL(run.href).host === "example.com")).toBe(true);
    expect(result.some((run) => run.strong)).toBe(true);
  });

  it("article decodes database relationships", () => {
    const article = decodeNewsArticle(
      JSON.parse(
        '{"id":"ee000000-0000-4000-8000-000000000021","slug":"test","title":"Title","summary":"Summary","body_markdown":"## Body","published_at":"2026-09-19T12:00:00Z","news_article_categories":[{"news_categories":{"name":"Dividendos"}}],"news_article_sources":[{"source_url":"https://example.com","source_title":null,"is_primary":true,"news_sources":{"name":"BODIVA"}}],"news_article_securities":[{"securities":{"id":"ee000000-0000-4000-8000-000000000022","symbol":"BFAAAAA","name":null}}] }',
      ),
    );
    expect(article?.categories[0]).toBe("Dividendos");
    expect(article?.sources[0]?.isPrimary).toBe(true);
    expect(article?.bodyMarkdown).toBe("## Body");
  });
});
