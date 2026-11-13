"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { BOOK_NAME_MAX, COMBINED, MAIN, type PortfolioBook, bookName, hasBookNamed } from "@/domain/portfolio/books";
import { useAccount } from "@/features/account/account-provider";
import { Button, IconButton } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { Menu, type MenuEntry } from "@/ui/components/menu";
import { Icon } from "@/ui/icons/icon";

import { ShareDialog } from "./share-dialog";
import type { PortfolioModel } from "./use-portfolio";

/** The page title for the selection: `Carteira` until named portfolios exist. */
export function useSelectionTitle(model: Pick<PortfolioModel, "books" | "selection">) {
  const t = useTranslations();
  if (model.books.length === 0) return t("common.portfolio");
  if (model.selection === COMBINED) return t("portfolioBooks.combined");
  if (model.selection === MAIN) return t("portfolioBooks.main");
  return model.books.find((book) => book.id === model.selection)?.name ?? t("common.portfolio");
}

type Naming = { mode: "new" } | { mode: "rename"; book: PortfolioBook };

/** iOS `PortfolioBookMenu`: switch portfolio, create one, manage them, share the selected one (all Plus). */
export function BookMenu({ model }: { model: PortfolioModel }) {
  const t = useTranslations();
  const account = useAccount();
  const [naming, setNaming] = useState<Naming | null>(null);
  const [managing, setManaging] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { books, selection } = model;

  const create = () => {
    if (account && !account.unlocksPlus) return account.requestUpgrade("portfolios");
    setNaming({ mode: "new" });
  };
  const share = () => {
    if (account && !account.unlocksPlus) return account.requestUpgrade("clientViews");
    setSharing(true);
  };

  const entries: MenuEntry[] = [
    ...(books.length > 0
      ? [
          { kind: "check" as const, label: t("portfolioBooks.combined"), checked: selection === COMBINED, onToggle: () => model.select(COMBINED) },
          { kind: "check" as const, label: t("portfolioBooks.main"), checked: selection === MAIN, onToggle: () => model.select(MAIN) },
          ...books.map((book) => ({ kind: "check" as const, label: book.name, checked: selection === book.id, onToggle: () => model.select(book.id) })),
          { kind: "separator" as const },
        ]
      : []),
    { kind: "item", label: t("portfolioBooks.new"), icon: "add", onSelect: create, testID: "book-new" },
    ...(books.length > 0 ? [{ kind: "item" as const, label: t("portfolioBooks.manage"), icon: "edit" as const, onSelect: () => setManaging(true), testID: "book-manage" }] : []),
    ...(model.singlePortfolio ? [{ kind: "item" as const, label: t("portfolioShare.menu"), icon: "share" as const, onSelect: share, testID: "book-share" }] : []),
  ];

  const save = async (name: string): Promise<"duplicate" | null> => {
    const current = naming;
    if (!current) return null;
    const book = current.mode === "new" ? { id: crypto.randomUUID(), name } : { ...current.book, name };
    const result = current.mode === "new" ? await model.store.createBook(book) : await model.store.renameBook(book);
    if (result === "duplicate") return "duplicate" as const;
    setNaming(null);
    if (result === "saved" && current.mode === "new") model.select(book.id);
    return null;
  };

  return (
    <>
      <Menu label={t("portfolioBooks.title")} icon="portfolio" entries={entries} testID="book-menu" />
      {naming ? <BookNameDialog naming={naming} books={books} onClose={() => setNaming(null)} onSave={save} /> : null}
      {managing ? (
        <ManageBooksDialog
          model={model}
          onClose={() => setManaging(false)}
          onRename={(book) => {
            setManaging(false);
            setNaming({ mode: "rename", book });
          }}
        />
      ) : null}
      {sharing ? <ShareDialog model={model} onClose={() => setSharing(false)} /> : null}
    </>
  );
}

/** `Nova carteira` / `Mudar nome`: a trimmed name of 1–40 characters, unique (any case). */
function BookNameDialog({
  naming,
  books,
  onClose,
  onSave,
}: {
  naming: Naming;
  books: readonly PortfolioBook[];
  onClose: () => void;
  onSave: (name: string) => Promise<"duplicate" | null>;
}) {
  const t = useTranslations();
  const id = useId();
  const [text, setText] = useState(naming.mode === "rename" ? naming.book.name : "");
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const name = bookName(text);
  const submit = async () => {
    if (!name) return;
    if (hasBookNamed(books, name, naming.mode === "rename" ? naming.book.id : undefined)) return setDuplicate(true);
    setSaving(true);
    const result = await onSave(name);
    setSaving(false);
    if (result === "duplicate") setDuplicate(true);
  };
  return (
    <Dialog
      variant="dialog"
      open
      onClose={onClose}
      title={t(naming.mode === "rename" ? "portfolioBooks.rename" : "portfolioBooks.new")}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button kind="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={!name} loading={saving} data-testid="book-save">
            {t(naming.mode === "rename" ? "portfolioBooks.renameConfirm" : "portfolioBooks.create")}
          </Button>
        </div>
      }
    >
      <form
        id={`${id}-form`}
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={id} className="text-secondary text-secondary-text">
          {t("portfolioBooks.name")}
        </label>
        <input
          id={id}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setDuplicate(false);
          }}
          maxLength={BOOK_NAME_MAX}
          autoComplete="off"
          data-autofocus
          aria-invalid={duplicate}
          aria-describedby={duplicate ? `${id}-error` : undefined}
          data-testid="book-name"
          className="min-h-11 w-full rounded-medium bg-elevated-background px-3 text-body text-primary-text outline-none focus:outline-2 focus:outline-accent"
        />
        {duplicate ? (
          <p id={`${id}-error`} role="alert" className="text-secondary text-negative">
            {t("portfolioBooks.duplicate")}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/** `Gerir carteiras`: rename, or delete with its records after a confirmation. */
function ManageBooksDialog({ model, onClose, onRename }: { model: PortfolioModel; onClose: () => void; onRename: (book: PortfolioBook) => void }) {
  const t = useTranslations();
  const [deleting, setDeleting] = useState<PortfolioBook | null>(null);
  const [busy, setBusy] = useState(false);
  const remove = async (book: PortfolioBook) => {
    setBusy(true);
    const result = await model.store.deleteBook(book.id);
    setBusy(false);
    setDeleting(null);
    if (result !== "saved") return;
    if (model.selection === book.id) model.select(COMBINED);
    // The last one gone: nothing left to manage.
    if (model.books.length === 1) onClose();
  };
  return (
    <>
      <Dialog open={!deleting} onClose={() => !deleting && onClose()} title={t("portfolioBooks.manage")}>
        <ul className="flex flex-col divide-y divide-separator" data-testid="book-list">
          {model.books.map((book) => (
            <li key={book.id} className="flex min-h-14 items-center gap-2">
              <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left text-body text-primary-text" onClick={() => onRename(book)}>
                <Icon name="portfolio" className="text-secondary-text" />
                <span className="truncate">{book.name}</span>
              </button>
              <IconButton icon="edit" label={t("portfolioBooks.rename")} onClick={() => onRename(book)} />
              <IconButton icon="trash" label={t("portfolioBooks.deleteTitle", { arg1: book.name })} onClick={() => setDeleting(book)} data-testid="book-delete" />
            </li>
          ))}
        </ul>
      </Dialog>
      {deleting ? (
        <Dialog
          variant="dialog"
          open
          onClose={() => setDeleting(null)}
          title={t("portfolioBooks.deleteTitle", { arg1: deleting.name })}
          footer={
            <div className="flex flex-col gap-3">
              <Button kind="destructive" loading={busy} onClick={() => void remove(deleting)} data-testid="book-delete-confirm">
                {t("portfolioBooks.deleteConfirm")}
              </Button>
              <Button kind="secondary" onClick={() => setDeleting(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          }
        >
          <p className="text-body text-primary-text">{t("portfolioBooks.deleteMessage")}</p>
        </Dialog>
      ) : null}
    </>
  );
}
