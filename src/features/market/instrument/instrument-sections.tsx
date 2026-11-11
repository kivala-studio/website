import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { PublicDividend, PublicFinancialReport, PublicInstrument, PublicIssuer } from "@/data/market/public";
import { bodivaMaturityDate } from "@/domain/market";
import { civilDate } from "@/domain/market/zone";
import { SectionHeader } from "@/ui/components/layout";
import { SectionPlaceholder } from "@/ui/components/states";
import { useFormat } from "@/ui/format";
import { Icon } from "@/ui/icons/icon";

import { DividendYield } from "./instrument-view";

/*
 * Server-rendered sections of the instrument page (iOS `BondFactsSection`, `AssetAboutSection`,
 * `AssetIssuerInformationSection`). They hold only catalogue and issuer data, never a price.
 */

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-5 border-b border-separator py-3">
      <dt className="text-secondary text-secondary-text">{title}</dt>
      <dd className="text-right text-secondary font-medium break-words text-primary-text">{children}</dd>
    </div>
  );
}

/** Missing optional reads: `undefined` is "none published", `null` is "the read failed". */
export type IssuerData = { issuer: PublicIssuer | undefined | null; dividend: PublicDividend | undefined | null; reports: PublicFinancialReport[] | null };

export function BondFacts({ instrument, issuerName }: { instrument: PublicInstrument; issuerName: string }) {
  const t = useTranslations();
  const format = useFormat();
  const maturity = bodivaMaturityDate(instrument.symbol);
  return (
    <section aria-labelledby="bond-facts" className="flex flex-col gap-2">
      <SectionHeader id="bond-facts" title={t("assetDetails.bondFacts.header")} />
      <dl className="flex flex-col">
        <Row title={t("common.issuer")}>{issuerName}</Row>
        {instrument.isin ? <Row title={t("assetDetails.bondFacts.isin")}>{instrument.isin}</Row> : null}
        <Row title={t("common.currency")}>{instrument.currency ?? "AOA"}</Row>
        {maturity !== undefined ? (
          <Row title={t("assetDetails.bondFacts.maturityFromCode")}>{format.maturity(civilDate(maturity))}</Row>
        ) : (
          <Row title={t("assetDetails.bondFacts.maturity")}>{t("assetDetails.bondFacts.unconfirmed")}</Row>
        )}
      </dl>
      {maturity !== undefined ? <p className="text-caption text-secondary-text">{t("assetDetails.bondFacts.maturityNote")}</p> : null}
      <dl className="flex flex-col">
        <Row title={t("assetDetails.bondFacts.coupon")}>{t("common.notAvailable")}</Row>
        <Row title={t("common.faceValue")}>{t("common.notAvailable")}</Row>
        <Row title={t("assetDetails.bondFacts.yieldToMaturity")}>{t("assetDetails.bondFacts.notCalculated")}</Row>
      </dl>
      <p className="text-caption text-secondary-text">{t("assetDetails.bondFacts.quoteDisclaimer")}</p>
    </section>
  );
}

export function AboutPanel({ instrument, issuerName, data }: { instrument: PublicInstrument; issuerName: string; data: IssuerData }) {
  const t = useTranslations();
  const summary = {
    equity: t("assetDetails.about.stock", { arg1: instrument.name, arg2: issuerName }),
    corporateBond: t("assetDetails.about.bondCompany", { arg1: instrument.name, arg2: issuerName }),
    treasuryBond: t("assetDetails.about.bondSovereign", { arg1: instrument.name }),
    fund: t("assetDetails.about.fundUnit", { arg1: instrument.name }),
    other: t("assetDetails.about.instrument", { arg1: instrument.name }),
  }[instrument.kind];
  const showsIssuer = instrument.kind === "equity" || instrument.kind === "corporateBond" || instrument.kind === "fund";
  return (
    <>
      <section aria-labelledby="about" className="flex flex-col gap-3">
        <SectionHeader id="about" title={t("common.about")} />
        <p className="text-body text-secondary-text">{summary}</p>
      </section>
      {showsIssuer ? <IssuerInformation instrument={instrument} data={data} /> : null}
    </>
  );
}

function IssuerInformation({ instrument, data }: { instrument: PublicInstrument; data: IssuerData }) {
  const t = useTranslations();
  const format = useFormat();
  const { issuer, dividend, reports } = data;
  const day = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? format.civilDate(value.slice(0, 10)) : value);
  const link = "inline-flex min-h-11 items-center gap-1 text-secondary font-medium text-accent";
  return (
    <>
      {issuer === null ? (
        <SectionPlaceholder title={t("common.issuer")} failed />
      ) : (
        <section aria-labelledby="issuer" className="flex flex-col gap-3">
          <SectionHeader id="issuer" title={instrument.kind === "fund" ? t("assetDetails.issuer.fundManager") : t("common.company")} />
          {issuer?.description ? <p className="text-body text-secondary-text">{issuer.description}</p> : null}
          {issuer && (issuer.sector || issuer.headquarters || issuer.websiteURL) ? (
            <dl className="flex flex-col">
              {issuer.sector ? <Row title={t("site.issuer.sector")}>{issuer.sector}</Row> : null}
              {issuer.headquarters ? <Row title={t("assetDetails.issuer.headquarters")}>{issuer.headquarters}</Row> : null}
              {issuer.websiteURL ? (
                <Row title={t("assetDetails.issuer.website")}>
                  <a
                    href={issuer.websiteURL}
                    rel="noopener noreferrer external"
                    target="_blank"
                    aria-label={t("assetDetails.accessibility.openWebsite", { arg1: issuer.name })}
                    className={link}
                  >
                    {new URL(issuer.websiteURL).host.replace(/^www\./, "")}
                    <Icon name="arrow-up-right" scale="s" />
                  </a>
                </Row>
              ) : null}
            </dl>
          ) : null}
        </section>
      )}

      <section aria-labelledby="dividends" className="flex flex-col gap-2">
        <SectionHeader id="dividends" title={t("common.dividends")} />
        {dividend === null ? (
          <p className="text-caption text-secondary-text">{t("components.placeholder.loadFailed")}</p>
        ) : dividend?.amountPerShare ? (
          <dl className="grid grid-cols-1 gap-x-6 min-[24rem]:grid-cols-2">
            {[
              [t("assetDetails.issuer.dividendPerShare"), format.currency(dividend.amountPerShare, { code: dividend.currency ?? "AOA", digits: 2 })],
              [t("site.issuer.dividendYield"), <DividendYield key="yield" id={instrument.id} amount={dividend.amountPerShare} />],
              ...(dividend.exDividendDate ? [[t("site.issuer.exDividend"), day(dividend.exDividendDate)]] : []),
              ...(dividend.paymentDate ? [[t("assetDetails.issuer.dividendPayment"), day(dividend.paymentDate)]] : []),
              ...(dividend.frequency ? [[t("assetDetails.issuer.dividendFrequency"), dividend.frequency]] : []),
            ].map(([title, value]) => (
              <div key={String(title)} className="flex min-h-18 flex-col justify-center gap-1 border-b border-separator py-2">
                <dt className="text-caption text-secondary-text">{title}</dt>
                <dd className="text-body text-primary-text">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="py-2 text-secondary text-secondary-text">{t("assetDetails.issuer.noDividends")}</p>
        )}
      </section>

      <section aria-labelledby="reports" className="flex flex-col gap-2">
        <SectionHeader id="reports" title={t("common.financialReports")} />
        {reports === null ? (
          <p className="text-caption text-secondary-text">{t("components.placeholder.loadFailed")}</p>
        ) : reports.length > 0 ? (
          <ul className="flex flex-col">
            {reports.slice(0, 3).map((report) => {
              const detail = [report.reportingPeriod, report.publishedAt && day(report.publishedAt)].filter(Boolean).join(" · ");
              return (
                <li key={report.id} className="flex items-center justify-between gap-4 border-b border-separator py-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-secondary font-medium text-primary-text">{report.title}</span>
                    {detail ? <span className="text-caption text-secondary-text">{detail}</span> : null}
                  </span>
                  <a
                    href={report.url}
                    rel="noopener noreferrer external"
                    target="_blank"
                    aria-label={t("assetDetails.accessibility.openReport", { arg1: report.title })}
                    className={link}
                  >
                    {t("assetDetails.issuer.viewReports")}
                    <Icon name="arrow-up-right" scale="s" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-2 text-secondary text-secondary-text">{t("assetDetails.issuer.noReports")}</p>
        )}
      </section>
    </>
  );
}
