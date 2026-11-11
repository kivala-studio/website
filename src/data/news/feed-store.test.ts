import { describe, expect, it } from "vitest";

import { CancellationError } from "@/domain/errors";
import { parseInstant } from "@/domain/market/zone";
import { type NewsArticle, decodeNewsArticle } from "@/domain/news/article";

import { type NewsRepository, NewsFeedStore } from "./feed-store";

// Ports NewsFeedTests.swift case for case.
let sequence = 0;
function article(title: string, publishedAt = Date.now()): NewsArticle {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    slug: title,
    title,
    summary: "Summary",
    bodyMarkdown: "Body",
    publishedAt,
    isRecap: false,
    categories: [],
    sources: [],
    securities: [],
  };
}

class FeedRepository implements NewsRepository {
  reads = 0;
  private fails = false;
  constructor(private values: NewsArticle[]) {}
  replace(articles: NewsArticle[]) {
    this.values = articles;
  }
  failNextRead() {
    this.fails = true;
  }
  async articles(offset: number, limit: number) {
    this.reads += 1;
    if (this.fails) {
      this.fails = false;
      throw new TypeError("Failed to fetch");
    }
    return this.values.slice(offset, offset + limit);
  }
}

const instant = (value: string) => parseInstant(value)!;

describe("news feed", () => {
  it("home uses today and yesterday in Luanda while the feed keeps the archive", async () => {
    const now = instant("2026-10-07T00:30:00+01:00");
    const yesterday = article("Yesterday", instant("2026-10-06T00:00:00+01:00"));
    const old = article("Old", yesterday.publishedAt - 1000);
    const today = article("Today", now);
    const home = new NewsFeedStore({ repository: new FeedRepository([today, yesterday, old]), homeSummariesOnly: true, now: () => now });
    await home.refresh();
    expect(home.articles).toEqual([today, yesterday]);
    const feed = new NewsFeedStore({ repository: new FeedRepository([today, yesterday, old]), now: () => now });
    await feed.refresh();
    expect(feed.articles).toEqual([today, yesterday, old]);
  });

  it("expired news disappears across midnight when refresh fails", async () => {
    let now = instant("2026-10-07T23:59:59+01:00");
    const yesterday = article("Yesterday", instant("2026-10-06T12:00:00+01:00"));
    const today = article("Today", now);
    const repository = new FeedRepository([today, yesterday]);
    const store = new NewsFeedStore({ repository, homeSummariesOnly: true, now: () => now });
    await store.refresh();
    expect(store.articles).toEqual([today, yesterday]);
    now += 1000;
    repository.failNextRead();
    await store.refresh();
    expect(store.articles).toEqual([today]);
    expect(store.errorKey).not.toBeNull();
  });

  it("publication appears without reopening the feed", async () => {
    const old = article("Old");
    const published = article("Published");
    const repository = new FeedRepository([old]);
    const store = new NewsFeedStore({ repository });
    let ticks = 0;
    await store.runAutomaticRefresh(async () => {
      ticks += 1;
      if (ticks === 1) repository.replace([published, old]);
      else throw new CancellationError();
    });
    expect(store.articles.map((item) => item.title)).toEqual(["Published", "Old"]);
    expect(store.isLoading).toBe(false);
  });

  it("failed refresh preserves visible publications and can recover", async () => {
    const published = article("Published");
    const repository = new FeedRepository([published]);
    const store = new NewsFeedStore({ repository });
    await store.refresh();
    repository.failNextRead();
    await store.refresh();
    expect(store.articles).toEqual([published]);
    expect(store.errorKey).not.toBeNull();
    expect(store.isLoading).toBe(false);
    await store.refresh();
    expect(store.errorKey).toBeNull();
  });

  it("refresh keeps loaded pages in one read and removes unpublished articles", async () => {
    const original = Array.from({ length: 45 }, (_, index) => article(`Article ${index}`));
    const repository = new FeedRepository(original);
    const store = new NewsFeedStore({ repository });
    await store.refresh();
    await store.loadMore();
    expect(store.articles).toEqual(original.slice(0, 40));
    expect(store.hasMore).toBe(true);
    const updated = [...original];
    updated.splice(30, 1);
    updated.unshift(article("New"));
    repository.replace(updated);
    const reads = repository.reads;
    await store.refresh();
    expect(repository.reads - reads).toBe(1);
    expect(store.articles).toEqual(updated.slice(0, 40));
    expect(store.hasMore).toBe(true);
    await store.loadMore();
    expect(store.articles).toEqual(updated);
    expect(store.hasMore).toBe(false);
  });

  it("recap publication uses the same article feed and detail model", () => {
    const base = {
      id: "6f1c1f43-7a41-4c4c-9a55-1c6d1d6ad111",
      slug: "recap",
      title: "Recap",
      summary: "Summary",
      body_markdown: "Body",
      published_at: "2026-10-02T11:09:48.101682+00:00",
      news_article_categories: [],
      news_article_sources: [],
      news_article_securities: [],
      market_recaps: { trading_date: "2026-10-01" },
    };
    const recap = decodeNewsArticle(base);
    expect(recap?.isRecap).toBe(true);
    expect(recap?.recapTradingDate).toBe("2026-10-01");
    expect(decodeNewsArticle({ ...base, market_recaps: null })?.isRecap).toBe(false);
  });
});
