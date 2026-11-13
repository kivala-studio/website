"use client";

import Decimal from "decimal.js";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, useSyncExternalStore } from "react";

import { formatAmountForInput, parseAmount } from "@/domain/format/amount-input";
import { BOND_COUPON_FREQUENCIES, type BondTerms, bodivaMaturityDate, calculateBondYield, displayPrice, isValidBondTerms } from "@/domain/market";
import { civilDate } from "@/domain/market/zone";
import { useMarketState } from "@/features/market/market-provider";
import { Button } from "@/ui/components/buttons";
import { AmountField } from "@/ui/components/amount-field";
import { OptionGroup } from "@/ui/components/controls";
import { Dialog } from "@/ui/components/dialog";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

const FREQUENCY_KEY = { 1: "bondYield.frequency.annual", 2: "bondYield.frequency.semiannual", 4: "bondYield.frequency.quarterly" } as const;
type Frequency = keyof typeof FREQUENCY_KEY;

/** Coupon terms the user saved for one bond, on this device only (iOS `BondTermsStore`). */
const termsKey = (symbol: string) => `investao.bondTerms.${symbol}`;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function readTerms(symbol: string): string | null {
  try {
    return window.localStorage.getItem(termsKey(symbol));
  } catch {
    return null;
  }
}
function decodeTerms(raw: string | null): BondTerms | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as { couponRate?: unknown; frequency?: unknown };
    const terms = { couponRate: new Decimal(String(value.couponRate)), frequency: Number(value.frequency) };
    return isValidBondTerms(terms) ? terms : undefined;
  } catch {
    return undefined;
  }
}

/** Saved terms of these bonds, by security id (iOS `BondTermsStore`), for the income calendar's coupons. */
export function useSavedBondTerms(bonds: readonly { id: string; symbol: string }[]): Record<string, BondTerms> {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(bonds.map((bond) => readTerms(bond.symbol))), () => "[]");
  return useMemo(() => {
    const values = JSON.parse(raw) as (string | null)[];
    return Object.fromEntries(
      bonds.flatMap((bond, index) => {
        const terms = decodeTerms(values[index] ?? null);
        return terms ? [[bond.id, terms]] : [];
      }),
    );
  }, [raw, bonds]);
}

function saveTerms(symbol: string, terms: BondTerms) {
  try {
    window.localStorage.setItem(termsKey(symbol), JSON.stringify({ couponRate: terms.couponRate.toString(), frequency: terms.frequency }));
  } catch {
    // Not kept: the calculation still shows.
  }
  for (const listener of listeners) listener();
}

/**
 * The coupon and yield rows of `Rendimento fixo`, and the yield calculator (iOS `BondYieldCalculatorView`).
 * Terms are typed by the user; the price defaults to the displayed one.
 */
export function BondYieldRows({ id, symbol }: { id: string; symbol: string }) {
  const t = useTranslations();
  const format = useFormat();
  const state = useMarketState();
  const raw = useSyncExternalStore(subscribe, () => readTerms(symbol), () => null);
  const saved = useMemo(() => decodeTerms(raw), [raw]);
  const [open, setOpen] = useState(false);
  const security = state.load.kind === "loaded" ? state.load.snapshot.securities.find((item) => item.id === id) : undefined;
  const at = state.assessedAt;
  const quoted = security && at !== undefined ? displayPrice(security, at) : undefined;
  const maturityInstant = bodivaMaturityDate(symbol);
  const maturity = maturityInstant === undefined ? undefined : civilDate(maturityInstant);
  const today = at === undefined ? undefined : civilDate(at);
  const result = saved && quoted && maturity && today ? calculateBondYield({ cleanPrice: quoted, terms: saved, maturity, settlement: today }) : undefined;

  return (
    <>
      <div className="flex items-baseline justify-between gap-5 border-b border-separator py-3">
        <dt className="text-secondary text-secondary-text">{t("assetDetails.bondFacts.coupon")}</dt>
        <dd className="text-right text-secondary font-medium text-primary-text">
          {saved ? `${format.percent(saved.couponRate, { signed: false })} · ${t(FREQUENCY_KEY[saved.frequency as Frequency])}` : t("common.notAvailable")}
        </dd>
      </div>
      <div className="border-b border-separator">
        <dt className="sr-only">{t("assetDetails.bondFacts.yieldToMaturity")}</dt>
        <dd>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            disabled={maturity === undefined || today === undefined}
            className="flex min-h-11 w-full items-center justify-between gap-5 py-3 text-left disabled:opacity-60"
            data-testid="bond-yield"
          >
            <span aria-hidden className="text-secondary text-secondary-text">
              {t("assetDetails.bondFacts.yieldToMaturity")}
            </span>
            <span className="flex items-center gap-1 text-secondary font-medium text-accent">
              {result ? format.percent(result.yieldToMaturity, { signed: false }) : t("bondYield.calculate")}
              <Icon name="chevron-right" />
            </span>
          </button>
        </dd>
      </div>
      {maturity && today && open ? (
        <BondYieldDialog open onClose={() => setOpen(false)} symbol={symbol} maturity={maturity} settlement={today} price={quoted} saved={saved} />
      ) : null}
    </>
  );
}

function BondYieldDialog({
  open,
  onClose,
  symbol,
  maturity,
  settlement,
  price,
  saved,
}: {
  open: boolean;
  onClose: () => void;
  symbol: string;
  maturity: string;
  settlement: string;
  price?: Decimal;
  saved?: BondTerms;
}) {
  const t = useTranslations();
  const format = useFormat();
  const ids = useId();
  const [priceText, setPriceText] = useState(price ? formatAmountForInput(price.toString()) : "");
  const [couponText, setCouponText] = useState(saved ? formatAmountForInput(saved.couponRate.toString()) : "");
  const [frequency, setFrequency] = useState<Frequency>((saved?.frequency as Frequency) ?? 2);
  const [remember, setRemember] = useState(saved !== undefined);
  const [shown, setShown] = useState<ReturnType<typeof calculateBondYield>>();

  const cleanPrice = parseAmount(priceText);
  const couponRate = parseAmount(couponText);
  const complete = cleanPrice !== null && cleanPrice.gt(0) && couponRate !== null;

  const calculate = () => {
    if (!complete) return;
    const terms = { couponRate: couponRate!, frequency };
    const result = calculateBondYield({ cleanPrice: cleanPrice!, terms, maturity, settlement });
    setShown(result);
    if (result && remember) saveTerms(symbol, terms);
  };

  const facts: [string, string][] = shown
    ? [
        [t("assetDetails.bondFacts.yieldToMaturity"), format.percent(shown.yieldToMaturity, { signed: false })],
        ...(shown.currentYield ? [[t("bondYield.currentYield"), format.percent(shown.currentYield, { signed: false })] as [string, string]] : []),
        [t("bondYield.accrued"), format.number(shown.accruedInterest, { digits: 4 })],
        [t("bondYield.dirtyPrice"), format.bondPrice(shown.dirtyPrice, { digits: 4 })],
        [t("bondYield.nextCoupon"), format.civilDate(shown.nextCouponDate)],
        [t("bondYield.remainingCoupons"), format.count(shown.remainingCoupons)],
      ]
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("assetDetails.bondFacts.yieldToMaturity")}
      footer={
        <Button className="w-full" onClick={calculate} disabled={!complete} data-testid="bond-yield-calculate">
          {complete ? t("bondYield.calculate") : t("bondYield.incomplete")}
        </Button>
      }
    >
      <form className="flex flex-col gap-5 px-5 pt-2 pb-6" onSubmit={(event) => (event.preventDefault(), calculate())}>
        <label className="flex flex-col gap-2" htmlFor={`${ids}-price`}>
          <span className="text-secondary font-semibold text-primary-text">{t("bondYield.price")}</span>
          <AmountField id={`${ids}-price`} value={priceText} onValueChange={setPriceText} suffix="%" inputMode="decimal" />
        </label>
        <label className="flex flex-col gap-2" htmlFor={`${ids}-coupon`}>
          <span className="text-secondary font-semibold text-primary-text">{t("bondYield.coupon")}</span>
          <AmountField id={`${ids}-coupon`} value={couponText} onValueChange={setCouponText} suffix="%" inputMode="decimal" data-testid="bond-coupon" />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-secondary font-semibold text-primary-text">{t("bondYield.frequency.label")}</span>
          <OptionGroup
            label={t("bondYield.frequency.label")}
            value={String(frequency)}
            onChange={(value) => setFrequency(Number(value) as Frequency)}
            options={BOND_COUPON_FREQUENCIES.map((value) => ({ value: String(value), title: t(FREQUENCY_KEY[value]) }))}
          />
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-5 accent-accent" />
          <span className="text-body text-primary-text">{t("bondYield.saveTerms")}</span>
        </label>
        {facts.length > 0 ? (
          <dl className="flex flex-col" aria-live="polite" data-testid="bond-yield-result">
            {facts.map(([title, value]) => (
              <div key={title} className="flex items-baseline justify-between gap-5 border-b border-separator py-3">
                <dt className="text-secondary text-secondary-text">{title}</dt>
                <dd className="text-secondary font-semibold text-primary-text tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </form>
    </Dialog>
  );
}
