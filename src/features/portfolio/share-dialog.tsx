"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";

import { serverRule } from "@/domain/errors";
import { writableBookId } from "@/domain/portfolio/books";
import { useAccount } from "@/features/account/account-provider";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { Spinner } from "@/ui/components/states";
import { useFormat } from "@/ui/format";

import { useSelectionTitle } from "./book-menu";
import { type PortfolioShare, accountShareRepository } from "./repository";
import type { PortfolioModel } from "./use-portfolio";

/** The address iOS shares; the website serves it at `/partilha/{token}`. */
export const SHARE_ORIGIN = "https://invest.ao";
const LABEL_MAX = 40;

/**
 * `Partilhar {portfolio}` (iOS `PortfolioShareSheet`, Plus): the selected portfolio's read-only links. A new
 * link's token is shown once, here, and lives only in this dialog's state: it is never stored or logged.
 */
export function ShareDialog({ model, onClose }: { model: PortfolioModel; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const account = useAccount()!;
  const title = useSelectionTitle(model);
  const repository = useMemo(() => accountShareRepository(account.userID), [account.userID]);
  const portfolioId = writableBookId(model.selection);
  const [shares, setShares] = useState<PortfolioShare[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    repository
      .list(portfolioId, controller.signal)
      .then(setShares)
      .catch(() => {
        if (!controller.signal.aborted) setMessage(t("portfolioShare.failed"));
      });
    return () => controller.abort();
  }, [repository, portfolioId, t]);

  const failed = (error: unknown) => {
    const rule = serverRule(error);
    if (rule?.upgrade) {
      onClose();
      return account.requestUpgrade(rule.upgrade.reason);
    }
    setMessage(t(rule?.code === "SHARE_LIMIT" ? "portfolioShare.limit" : "portfolioShare.failed"));
  };

  const create = async (label: string) => {
    try {
      const token = await repository.create(portfolioId, label);
      setCreated(`${SHARE_ORIGIN}/partilha/${token}`);
      setCreating(false);
      setMessage(null);
      setShares(await repository.list(portfolioId));
    } catch (error) {
      failed(error);
    }
  };

  const revoke = async (share: PortfolioShare) => {
    try {
      await repository.revoke(share.id);
      setShares((current) => current?.filter((item) => item.id !== share.id) ?? null);
    } catch (error) {
      failed(error);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolioShare.title", { arg1: title })}
      footer={
        creating ? null : (
          <Button kind="secondary" icon="add" onClick={() => setCreating(true)} data-testid="share-new">
            {t("portfolioShare.new")}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="share-dialog">
        {message ? (
          <p role="alert" className="text-secondary text-negative">
            {message}
          </p>
        ) : null}
        {creating ? <NewShareForm onCancel={() => setCreating(false)} onCreate={create} /> : null}
        {created ? <CreatedLink url={created} /> : null}
        {shares === null && !message ? (
          <Spinner className="mx-auto size-6 text-secondary-text" />
        ) : shares?.length === 0 && !created ? (
          <p className="py-4 text-center text-body text-secondary-text">{t("portfolioShare.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-separator" data-testid="share-list">
            {(shares ?? []).map((share) => (
              <li key={share.id} className="flex min-h-14 items-center gap-3 py-2" data-testid="share-row">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body text-primary-text">{share.label}</span>
                  <span className="text-caption text-secondary-text">{format.date(Date.parse(share.createdAt))}</span>
                </span>
                <Button kind="destructive" className="w-auto! shrink-0" onClick={() => void revoke(share)} data-testid="share-revoke">
                  {t("portfolioShare.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

function NewShareForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (label: string) => Promise<void> }) {
  const t = useTranslations();
  const id = useId();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const label = text.trim();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!label) return;
        setSaving(true);
        await onCreate(label);
        setSaving(false);
      }}
    >
      <label htmlFor={id} className="text-secondary text-secondary-text">
        {t("portfolioShare.label")}
      </label>
      <input
        id={id}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={LABEL_MAX}
        autoComplete="off"
        autoFocus
        data-testid="share-label"
        className="min-h-11 w-full rounded-medium bg-elevated-background px-3 text-body text-primary-text outline-none focus:outline-2 focus:outline-accent"
      />
      <div className="grid grid-cols-2 gap-3">
        <Button kind="secondary" type="button" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={!label} loading={saving} data-testid="share-create">
          {t("portfolioShare.create")}
        </Button>
      </div>
    </form>
  );
}

/** The new link, once: copy it, or hand it to the system share sheet where there is one. */
function CreatedLink({ url }: { url: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="flex flex-col gap-3 rounded-medium bg-elevated-background p-4">
      <output className="break-all font-mono text-secondary text-primary-text" data-testid="share-url">
        {url}
      </output>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          kind="secondary"
          icon={copied ? "check" : "copy"}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          data-testid="share-copy"
        >
          {t(copied ? "site.portfolio.linkCopied" : "site.portfolio.copyLink")}
        </Button>
        {canShare ? (
          <Button kind="secondary" icon="share" onClick={() => void navigator.share({ url }).catch(() => {})}>
            {t("portfolioShare.send")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
