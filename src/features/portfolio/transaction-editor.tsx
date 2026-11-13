"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { formatAmountForInput, parseAmount } from "@/domain/format/amount-input";
import { luandaCivilDate } from "@/domain/format/date";
import { compareText, isVisibleOutsideSearch, kindSearchTerms, searchSecurities } from "@/domain/market";
import type { PortfolioTransaction, PortfolioTransactionKind } from "@/domain/portfolio";
import { type RecordIssue, netAmount, priceScaleOf, recordIssues, supportsLedger } from "@/domain/portfolio/records";
import { cn } from "@/ui/cn";
import { AmountField } from "@/ui/components/amount-field";
import { Button } from "@/ui/components/buttons";
import { SectionTabs, SearchField } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { SecurityLogo } from "@/ui/components/rows";
import { EmptyState } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import type { SaveResult } from "./portfolio-store";
import type { PortfolioInstrument, PortfolioModel } from "./use-portfolio";

/** What opened the editor: a new purchase (starts with the picker), a record for a known instrument, or an edit. */
export type EditorRequest =
  | { mode: "new" }
  | { mode: "add"; kind: PortfolioTransactionKind; securityId: string; prefill?: { price: Decimal; date: string } }
  | { mode: "edit"; record: PortfolioTransaction };

const TITLES = {
  new: { buy: "common.recordPurchase", sell: "common.recordSale", income: "common.recordIncome" },
  edit: { buy: "portfolio.editor.editBuyTitle", sell: "portfolio.editor.editSellTitle", income: "portfolio.editor.editIncomeTitle" },
  save: { buy: "portfolio.editor.saveBuy", sell: "portfolio.editor.saveSell", income: "portfolio.editor.saveIncome" },
  date: { buy: "portfolio.form.purchaseDate", sell: "portfolio.form.saleDate", income: "portfolio.form.paymentDate" },
} as const;

type Field = "quantity" | "price" | "fees" | "date" | "form";

/** The inline message for each rule, under the field it belongs to. */
const MESSAGES: Record<RecordIssue | Exclude<SaveResult, "saved" | "failed">, { field: Field; key: string }> = {
  quantity: { field: "quantity", key: "portfolio.validation.quantityPositive" },
  wholeQuantity: { field: "quantity", key: "portfolio.validation.quantityWholeNumber" },
  price: { field: "price", key: "portfolio.validation.unitPricePositive" },
  fees: { field: "fees", key: "portfolio.validation.amountNonNegative" },
  taxExceedsGross: { field: "fees", key: "portfolio.validation.taxExceedsGross" },
  overflow: { field: "form", key: "portfolio.validation.costExceedsLimit" },
  futureDate: { field: "date", key: "portfolio.validation.dateInFuture" },
  unsupported: { field: "form", key: "portfolio.csvTransfer.instrumentUnsupported" },
  oversell: { field: "quantity", key: "portfolio.validation.saleExceedsHoldings" },
  income: { field: "fees", key: "portfolio.validation.taxExceedsGross" },
  identity: { field: "form", key: "portfolio.error.saveRetryMessage" },
};

const draft = (value: Decimal | undefined, fallback: string) => (value ? formatAmountForInput(value).replace(/,0+$/, "") : fallback);

export function TransactionEditor({ request, model, onClose }: { request: EditorRequest | null; model: PortfolioModel; onClose: () => void }) {
  // A new instance per request: one id per editor, so retrying a save never stores a second record.
  return request ? <EditorSheet key={request.mode === "edit" ? request.record.id : `${request.mode}-${"securityId" in request ? request.securityId : ""}`} request={request} model={model} onClose={onClose} /> : null;
}

function EditorSheet({ request, model, onClose }: { request: EditorRequest; model: PortfolioModel; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const record = request.mode === "edit" ? request.record : undefined;
  const prefill = request.mode === "add" ? request.prefill : undefined;
  const kind: PortfolioTransactionKind = record?.kind ?? (request.mode === "add" ? request.kind : "buy");
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const [createdAt] = useState(() => record?.createdAt ?? new Date().toISOString());
  // A record keeps its portfolio; a new one goes to the selected portfolio (the main one when combined).
  const [portfolioId] = useState(() => (record ? (record.portfolioId ?? null) : model.writableBookId));
  const [securityId, setSecurityId] = useState<string | undefined>(record?.securityId ?? (request.mode === "add" ? request.securityId : undefined));
  const today = luandaCivilDate(model.asOf);
  const initial = useMemo(
    () => ({
      quantity: kind === "income" ? "1" : draft(record?.quantity, "1"),
      price: draft(record?.unitPrice ?? prefill?.price, ""),
      fees: draft(record?.fees, ""),
      date: record?.tradedOn ?? prefill?.date ?? today,
    }),
    [kind, record, prefill, today],
  );
  const [values, setValues] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<Exclude<SaveResult, "saved" | "failed"> | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const instrument = securityId ? model.instruments.get(securityId) : undefined;
  const dirty = values.quantity !== initial.quantity || values.price !== initial.price || values.fees !== initial.fees || values.date !== initial.date || securityId !== record?.securityId;
  const ids = { quantity: useId(), price: useId(), fees: useId(), date: useId() };

  const transaction = useMemo((): PortfolioTransaction | null => {
    if (!securityId) return null;
    const amount = (text: string, empty: Decimal | null) => (text.trim() === "" ? empty : parseAmount(text));
    const quantity = kind === "income" ? new Decimal(1) : amount(values.quantity, null);
    const price = amount(values.price, null);
    const fees = amount(values.fees, new Decimal(0));
    return {
      id,
      securityId,
      kind,
      quantity: quantity ?? new Decimal(Number.NaN),
      unitPrice: price ?? new Decimal(Number.NaN),
      fees: fees ?? new Decimal(Number.NaN),
      tradedOn: values.date,
      createdAt,
      portfolioId,
    };
  }, [securityId, kind, values, id, createdAt, portfolioId]);

  const issues = transaction && instrument ? recordIssues(transaction, instrument, model.asOf) : [];
  const messages = new Map<Field, string>();
  if (attempted) for (const issue of issues) if (!messages.has(MESSAGES[issue].field)) messages.set(MESSAGES[issue].field, t((kind === "income" && issue === "price" ? "portfolio.validation.amountPositive" : MESSAGES[issue].key) as never));
  if (refusal && !messages.has(MESSAGES[refusal].field)) messages.set(MESSAGES[refusal].field, t(MESSAGES[refusal].key as never));

  const scale = instrument ? priceScaleOf(instrument.kind) : new Decimal(1);
  const total = transaction && issues.length === 0 ? netAmount(transaction, scale) : null;
  const quote = securityId && kind !== "income" ? model.lastQuote(securityId) : undefined;
  const close = () => (dirty && !saving ? setDiscarding(true) : onClose());

  const save = async () => {
    setAttempted(true);
    setRefusal(null);
    if (!transaction || issues.length > 0) return;
    setSaving(true);
    const result = await (record ? model.store.update(transaction) : model.store.create(transaction));
    setSaving(false);
    if (result === "saved") onClose();
    else if (result !== "failed") setRefusal(result);
  };

  const title = t((record ? TITLES.edit : TITLES.new)[kind]);
  if (!instrument) {
    return <InstrumentPicker model={model} onPick={setSecurityId} onClose={onClose} />;
  }

  const field = (name: "quantity" | "price" | "fees", label: string, suffix: string, big = false) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={ids[name]} className={cn(big ? "text-section" : "text-secondary", "text-primary-text")}>
        {label}
      </label>
      <div className={cn("flex items-center gap-2 rounded-medium bg-elevated-background px-3 focus-within:outline-2 focus-within:outline-accent", big ? "min-h-16" : "min-h-12 desk:min-h-11")}>
        <AmountField
          id={ids[name]}
          value={values[name]}
          onValueChange={(text) => (setValues((current) => ({ ...current, [name]: text })), setRefusal(null))}
          inputMode={name === "quantity" && instrument.kind === "equity" ? "numeric" : "decimal"}
          aria-invalid={messages.has(name)}
          aria-describedby={messages.has(name) ? `${ids[name]}-error` : undefined}
          data-autofocus={big ? true : undefined}
          data-testid={`editor-${name}`}
          className={cn("min-w-0 flex-1 bg-transparent text-primary-text outline-none", big ? "text-headline" : "text-body")}
        />
        {suffix ? <span className="text-body text-secondary-text">{suffix}</span> : null}
      </div>
      {messages.has(name) ? (
        <p id={`${ids[name]}-error`} className="text-secondary text-negative" role="alert">
          {messages.get(name)}
        </p>
      ) : null}
    </div>
  );

  const bond = instrument.bond;
  const headline =
    kind === "income"
      ? field("price", t("portfolio.form.grossReceived"), "Kz", true)
      : field("quantity", t(bond ? (kind === "buy" ? "portfolio.form.nominalBought" : "portfolio.form.nominalSold") : kind === "buy" ? "portfolio.form.unitsBoughtPrompt" : "portfolio.form.unitsSoldPrompt"), bond ? "Kz" : "", true);

  return (
    <>
      <Dialog
        open
        onClose={close}
        title={title}
        footer={
          <Button icon="check" className="w-full" loading={saving} onClick={save} data-testid="editor-save">
            {t(TITLES.save[kind])}
          </Button>
        }
      >
        <form
          className="flex flex-col gap-5"
          data-testid="transaction-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center gap-3">
            <SecurityLogo symbol={instrument.symbol} logoUrl={instrument.logoURL} brandColor={bond ? "violet" : "blue"} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-section text-primary-text">{instrument.symbol}</span>
              <span className="truncate text-secondary text-secondary-text">{instrument.name}</span>
            </span>
            {request.mode === "new" ? (
              <Button kind="secondary" onClick={() => setSecurityId(undefined)}>
                {t("portfolio.form.changeInstrument")}
              </Button>
            ) : null}
          </div>
          {headline}
          {kind !== "income" ? field("price", t(bond ? "portfolio.form.pricePercentOfPar" : "portfolio.form.unitPrice"), bond ? "%" : "Kz") : null}
          {field("fees", t(kind === "income" ? "portfolio.form.taxWithheld" : "portfolio.form.fees"), "Kz")}
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.date} className="text-secondary text-primary-text">
              {t(TITLES.date[kind])}
            </label>
            <input
              id={ids.date}
              type="date"
              required
              max={today}
              value={values.date}
              onChange={(event) => (setValues((current) => ({ ...current, date: event.target.value })), setRefusal(null))}
              aria-invalid={messages.has("date")}
              data-testid="editor-date"
              className="min-h-12 rounded-medium bg-elevated-background px-3 text-body text-primary-text desk:min-h-11"
            />
            {messages.has("date") ? (
              <p className="text-secondary text-negative" role="alert">
                {messages.get("date")}
              </p>
            ) : null}
          </div>
          {total && total.gt(0) ? (
            <p className="flex items-baseline justify-between gap-3 text-body text-primary-text" data-testid="editor-total">
              <span>{t(kind === "buy" ? "portfolio.form.totalCost" : kind === "sell" ? "portfolio.form.netSaleProceeds" : "portfolio.form.netReceived")}</span>
              <span className="font-semibold">{format.currency(total, { digits: 2 })}</span>
            </p>
          ) : null}
          {quote ? (
            <p className="flex items-baseline justify-between gap-3 text-secondary text-secondary-text">
              <span>{t("portfolio.form.lastQuote")}</span>
              <span>{format.securityPrice(quote, { bond })}</span>
            </p>
          ) : null}
          {messages.has("form") ? (
            <p className="text-secondary text-negative" role="alert">
              {messages.get("form")}
            </p>
          ) : null}
          <button type="submit" hidden />
        </form>
      </Dialog>
      <Dialog
        variant="dialog"
        open={discarding}
        onClose={() => setDiscarding(false)}
        title={t("portfolio.discardConfirmation.title")}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
            <Button kind="destructive" className="w-full" onClick={onClose} data-testid="discard">
              {t("portfolio.discardConfirmation.discard")}
            </Button>
            <Button kind="secondary" className="w-full" onClick={() => setDiscarding(false)}>
              {t("portfolio.discardConfirmation.continueEditing")}
            </Button>
          </div>
        }
      >
        <p className="text-body text-primary-text">{t("portfolio.discardConfirmation.message")}</p>
      </Dialog>
    </>
  );
}

const PICKER_TABS = [
  { key: "common.allItems", kinds: null },
  { key: "common.stocks", kinds: ["equity"] },
  { key: "common.funds", kinds: ["fund"] },
  { key: "common.bonds", kinds: ["corporateBond", "treasuryBond"] },
] as const;

/** `Escolher instrumento`: listed instruments a ledger may hold, by symbol, with search and kind tabs. */
function InstrumentPicker({ model, onPick, onClose }: { model: PortfolioModel; onPick: (id: string) => void; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(0);
  const resultsID = useId();
  const translate = (key: string) => t(key as never);
  const candidates = useMemo(() => {
    const pool = [...model.securities.values()].filter((security) => supportsLedger(security) && isVisibleOutsideSearch(security, model.asOf));
    if (query.trim() !== "") return searchSecurities(pool, query, { now: model.asOf, kindTerms: kindSearchTerms(translate) });
    const kinds: readonly string[] | null = PICKER_TABS[tab].kinds;
    return pool.filter((security) => !kinds || kinds.includes(security.kind)).sort((a, b) => compareText(a.symbol, b.symbol));
  }, [model.securities, model.asOf, query, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open onClose={onClose} title={t("common.chooseInstrument")}>
      <div className="flex flex-col gap-3" data-testid="instrument-picker">
        <SearchField value={query} onChange={setQuery} placeholder={t("portfolio.picker.searchInstruments")} controls={resultsID} autoFocus />
        {query.trim() === "" ? <SectionTabs label={t("common.chooseInstrument")} titles={PICKER_TABS.map((item) => t(item.key))} selected={tab} onSelect={setTab} /> : null}
        <p className="text-caption text-secondary-text">{t("common.instrumentsCount", { arg1: format.count(candidates.length) })}</p>
        {candidates.length === 0 ? (
          <div className="py-8">
            <EmptyState icon="search" title={t("common.noResults")} />
          </div>
        ) : (
          <ul id={resultsID} className="flex flex-col divide-y divide-hairline">
            {candidates.map((security) => {
              const instrument: PortfolioInstrument | undefined = model.instruments.get(security.id);
              return (
                <li key={security.id}>
                  <button type="button" onClick={() => onPick(security.id)} className="flex min-h-16 w-full items-center gap-3 py-2 text-left" data-testid="picker-row">
                    <SecurityLogo symbol={security.symbol} logoUrl={instrument?.logoURL ?? security.logoURL} brandColor={instrument?.bond ? "violet" : "blue"} size="s" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-semibold text-primary-text">{security.symbol}</span>
                      <span className="truncate text-secondary text-secondary-text">{instrument?.name ?? security.name}</span>
                    </span>
                    <Icon name="add" className="text-accent" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
