"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId, useRef, useState } from "react";

import { type WebCheckoutFailure, type WebPaymentMethod, type WebPlan, angolanMobile, annualSaving, webOrderNIF } from "@/domain/billing/web-pass";
import { APP_STORE_SUBSCRIPTIONS_URL } from "@/features/site/site";
import { Button } from "@/ui/components/buttons";
import { SegmentedControl } from "@/ui/components/controls";
import { INPUT, INPUT_BARE, INPUT_BOX } from "@/ui/components/field-styles";
import { Card } from "@/ui/components/layout";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

/** The amount as the card's hero figure; a step smaller on the narrowest phones, so a long price stays on one line. */
export const AMOUNT_HERO = "font-display text-headline text-primary-text max-[22.5rem]:text-[2.25rem]";

/** The saving on the 12-month option: a small accent pill after its title. */
const SAVING_BADGE = "rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent";

export type CheckoutRequest = { plan: WebPlan; method: WebPaymentMethod; phone?: string; nif: string | null };

/** A failure the form shows on a field; any other failure shows above the button. */
export type FieldFailure = Extract<WebCheckoutFailure, "invalidPhone" | "invalidNIF">;

/**
 * The web pass purchase: the plan (12 months first, with its saving), its price as the hero, the payment method, the
 * phone for Express and an optional NIF, then one button that states the amount. Fields are checked on submit;
 * an error sits on its field and is announced. `submit` resolves once the request has an answer.
 */
export function CheckoutForm({
  plans,
  storeSubscription,
  failure,
  onSubmit,
}: {
  plans: readonly WebPlan[];
  storeSubscription: boolean;
  /** The last answer's failure, if it was one: a field's, or the form's. */
  failure: WebCheckoutFailure | null;
  onSubmit: (request: CheckoutRequest) => Promise<void>;
}) {
  const t = useTranslations();
  const format = useFormat();
  const id = useId();
  const [planID, setPlanID] = useState(() => (plans.find((plan) => plan.months === 12) ?? plans[0]).id);
  const [method, setMethod] = useState<WebPaymentMethod>("mcx_express");
  const [phone, setPhone] = useState("");
  const [nif, setNIF] = useState("");
  const [invalid, setInvalid] = useState<FieldFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const phoneField = useRef<HTMLInputElement>(null);
  const nifField = useRef<HTMLInputElement>(null);

  const plan = plans.find((item) => item.id === planID) ?? plans[0];
  const saving = annualSaving(plans);
  const amount = format.currency(plan.priceAOA, { digits: 2 });
  // The server's answer wins once it arrives; a local check shows until the next submit.
  const fieldError: FieldFailure | null = invalid ?? (failure === "invalidPhone" || failure === "invalidNIF" ? failure : null);
  const formError = failure && failure !== "invalidPhone" && failure !== "invalidNIF" && !invalid ? failure : null;
  const phoneError = method === "mcx_express" && fieldError === "invalidPhone";
  const nifError = fieldError === "invalidNIF";
  const months = (count: number) => t("site.plans.months", { count });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const mobile = method === "mcx_express" ? angolanMobile(phone) : null;
    const taxID = webOrderNIF(nif);
    if (method === "mcx_express" && !mobile) {
      setInvalid("invalidPhone");
      phoneField.current?.focus();
      return;
    }
    if (taxID === false) {
      setInvalid("invalidNIF");
      nifField.current?.focus();
      return;
    }
    setInvalid(null);
    busy.current = true;
    setSubmitting(true);
    try {
      await onSubmit({ plan, method, ...(mobile ? { phone: mobile } : {}), nif: taxID });
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6" data-testid="checkout-form">
        <div className="flex flex-col gap-4">
          {plans.length > 1 ? (
            <SegmentedControl
              label={t("subscriptions.plan.chooseTitle")}
              value={plan.id}
              onChange={setPlanID}
              options={plans.map((item) => {
                const shows = saving && item.months === 12;
                const percent = saving ? format.percent(saving.percent, { digits: 0, signed: false }) : "";
                return {
                  value: item.id,
                  title: months(item.months),
                  spoken: shows ? `${months(item.months)}, ${t("subscriptions.plan.savings", { arg1: format.number(saving.percent, { digits: 0 }) })}` : undefined,
                  trailing: shows ? <span className={SAVING_BADGE}>{t("site.plans.saving", { percent })}</span> : undefined,
                };
              })}
            />
          ) : (
            <p className="text-body font-semibold text-primary-text">{months(plan.months)}</p>
          )}
          <p className={AMOUNT_HERO} data-testid="checkout-price">
            {amount}
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-hairline pt-6">
          <SegmentedControl
            label={t("site.plans.method")}
            value={method}
            onChange={(next) => {
              setMethod(next);
              if (invalid === "invalidPhone") setInvalid(null);
            }}
            options={[
              { value: "mcx_express", title: t("site.plans.express") },
              { value: "reference", title: t("site.plans.reference") },
            ]}
          />

          {method === "mcx_express" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-phone`} className="text-secondary font-semibold text-primary-text">
                {t("site.plans.phone")}
              </label>
              <span className={INPUT_BOX}>
                <span aria-hidden className="text-body text-secondary-text">
                  {t("site.plans.phonePrefix")}
                </span>
                <input
                  ref={phoneField}
                  id={`${id}-phone`}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-invalid={phoneError || undefined}
                  aria-describedby={phoneError ? `${id}-phone-error` : undefined}
                  data-testid="checkout-phone"
                  className={INPUT_BARE}
                />
              </span>
              {phoneError ? (
                <p id={`${id}-phone-error`} role="alert" className="motion-presence text-secondary text-negative">
                  {t("site.plans.failure.invalidPhone")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-nif`} className="text-secondary font-semibold text-primary-text">
              {t("site.plans.nif")}
            </label>
            <input
              ref={nifField}
              id={`${id}-nif`}
              name="nif"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={nif}
              onChange={(event) => setNIF(event.target.value)}
              aria-invalid={nifError || undefined}
              aria-describedby={nifError ? `${id}-nif-error` : undefined}
              data-testid="checkout-nif"
              className={INPUT}
            />
            {nifError ? (
              <p id={`${id}-nif-error`} role="alert" className="motion-presence text-secondary text-negative">
                {t("site.plans.failure.invalidNIF")}
              </p>
            ) : null}
          </div>
        </div>

        {storeSubscription ? (
          <div className="flex items-start gap-3 rounded-medium border border-panel-edge bg-canvas p-4" data-testid="store-notice">
            <Icon name="info" className="mt-0.5 shrink-0 text-accent" />
            <p className="text-secondary text-primary-text">
              {t("site.plans.storeNotice")}{" "}
              <a href={APP_STORE_SUBSCRIPTIONS_URL} className="font-semibold text-accent underline underline-offset-4">
                {t("settings.deleteAccount.manageSubscription")}
              </a>
            </p>
          </div>
        ) : null}

        {formError ? (
          <p role="alert" className="motion-presence text-secondary text-negative" data-testid="checkout-error">
            {t(`site.plans.failure.${formError}`)}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} data-testid="checkout-submit">
          {t("site.plans.pay", { amount })}
        </Button>
      </form>
    </Card>
  );
}
