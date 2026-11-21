"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Private } from "@/features/portfolio/portfolio-ui";
import { PrivacyModeButton, PrivacyModeProvider } from "@/features/privacy/privacy-mode";
import { Button, IconButton } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";
import { HiddenValue, OfflineBanner, SensitiveValue, useToast } from "@/ui/components/feedback";
import { AssetRow } from "@/ui/components/rows";
import { FinancialValue } from "@/ui/components/financial";
import { Card } from "@/ui/components/layout";
import { CardSkeleton, PageHeadingSkeleton, PageSkeleton, PanelSkeleton, RowsSkeleton, TableSkeleton } from "@/ui/components/page-skeleton";
import { Menu } from "@/ui/components/menu";
import {
  ChartShimmer,
  EmptyState,
  ErrorState,
  InstrumentRowSkeleton,
  LoadingState,
  SectionPlaceholder,
  Skeleton,
  Spinner,
} from "@/ui/components/states";
import { ICON_PACK } from "@/ui/icons/icon-pack";

import { GallerySection, SPECIMEN_GRID, Specimen, Variant } from "./specimen";

export function Overlays() {
  const t = useTranslations();
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sort, setSort] = useState<"name" | "price">("name");
  return (
    <GallerySection id="overlays" title="Overlays">
      <div className={SPECIMEN_GRID}>
        <Specimen name='Dialog variant="sheet" · variant="dialog"'>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button kind="secondary" onClick={() => setSheet(true)}>
              Sheet
            </Button>
            <Button kind="secondary" onClick={() => setDialog(true)}>
              Dialog
            </Button>
          </div>
          <Dialog
            open={sheet}
            onClose={() => setSheet(false)}
            title={t("designSystem.gallery.valuesHeader")}
            footer={<Button onClick={() => setSheet(false)}>{t("designSystem.gallery.viewPortfolio")}</Button>}
          >
            <AssetRow symbol="BAIAAAAA" name="Banco Angolano de Investimentos" price="65000" change="2.14" />
          </Dialog>
          <Dialog open={dialog} onClose={() => setDialog(false)} title={t("designSystem.gallery.surface")} variant="dialog">
            <p className="text-body">{t("designSystem.gallery.sampleInsightMessage")}</p>
          </Dialog>
        </Specimen>

        <Specimen name="Menu">
          <div className="flex flex-wrap items-center gap-4">
            <Variant label="icon trigger">
              <Menu
                label="Row options"
                entries={[
                  { kind: "heading", label: "BAIAAAAA" },
                  { kind: "item", label: t("designSystem.gallery.openActivity"), icon: "notification", onSelect: () => undefined },
                  { kind: "item", label: ICON_PACK.share.label, icon: "share", onSelect: () => undefined, disabled: true },
                  { kind: "separator" },
                  { kind: "item", label: t("common.deleteAccount"), icon: "trash", onSelect: () => undefined, destructive: true },
                ]}
              />
            </Variant>
            <Variant label="trigger={…} · check entries">
              <Menu
                label={t("markets.picker.sortBy")}
                align="start"
                trigger={t("markets.picker.sortBy")}
                entries={[
                  { kind: "check", label: t("common.instrument"), checked: sort === "name", onToggle: () => setSort("name") },
                  { kind: "check", label: t("common.price"), checked: sort === "price", onToggle: () => setSort("price") },
                ]}
              />
            </Variant>
          </div>
        </Specimen>
      </div>
    </GallerySection>
  );
}

function ToastDemo() {
  const t = useTranslations();
  const { show } = useToast();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button kind="secondary" onClick={() => show({ title: t("components.emptyState.dataUnavailable"), message: t("components.placeholder.loadFailed") })}>
        Toast
      </Button>
      <Button
        kind="secondary"
        onClick={() =>
          show({
            title: t("components.emptyState.dataUnavailable"),
            message: t("components.placeholder.loadFailed"),
            actionTitle: t("common.tryAgain"),
            onRetry: () => new Promise((resolve) => setTimeout(resolve, 1200)),
          })
        }
      >
        {`Toast + ${t("common.tryAgain")}`}
      </Button>
    </div>
  );
}

export function FeedbackAndStates() {
  const t = useTranslations();
  const [hidden, setHidden] = useState(true);
  return (
    <GallerySection id="feedback" title="Feedback and states">
      <div className={SPECIMEN_GRID}>
        <Specimen name="useToast · OfflineBanner">
          <ToastDemo />
          <OfflineBanner forceVisible />
        </Specimen>

        <Specimen name="PrivacyModeButton · Private · HiddenValue · SensitiveValue">
          <PrivacyModeProvider initial={false}>
            <div className="flex items-center gap-4">
              <PrivacyModeButton />
              <Private className="font-display text-price text-primary-text">1 250 000,00 Kz</Private>
            </div>
          </PrivacyModeProvider>
          <Variant label="HiddenValue">
            <HiddenValue className="text-price" />
          </Variant>
          <Variant label="SensitiveValue hidden={…}">
            <div className="flex items-center gap-4">
              <SensitiveValue hidden={hidden}>
                <FinancialValue value="1250000" digits={0} style="price" />
              </SensitiveValue>
              <IconButton
                icon={hidden ? "eye" : "eye-off"}
                label={hidden ? t("components.privacy.showValues") : t("components.privacy.hideValues")}
                onClick={() => setHidden((value) => !value)}
              />
            </div>
          </Variant>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="EmptyState">
          <Card>
            <EmptyState
              title={t("components.emptyState.noFavoritesTitle")}
              message={t("components.emptyState.noFavoritesMessage")}
              icon="watchlist"
              action={
                <Button icon="add" className="w-auto!">
                  {t("common.addInstruments")}
                </Button>
              }
            />
          </Card>
        </Specimen>
        <Specimen name="ErrorState">
          <Card>
            <ErrorState
              message={t("components.placeholder.loadFailed")}
              action={
                <Button kind="secondary" className="w-auto!">
                  {t("common.tryAgain")}
                </Button>
              }
            />
          </Card>
        </Specimen>
      </div>

      <div className={SPECIMEN_GRID}>
        <Specimen name="LoadingState · Spinner">
          <Card>
            <LoadingState />
          </Card>
          <Variant label="Spinner">
            <Spinner className="text-[1.5rem] text-accent" />
          </Variant>
        </Specimen>
        <Specimen name="Skeleton · InstrumentRowSkeleton · ChartShimmer">
          <Card className="flex flex-col gap-4">
            <Skeleton className="h-6 w-40" />
            <InstrumentRowSkeleton />
            <ChartShimmer />
          </Card>
        </Specimen>
      </div>

      <Specimen name="Route skeletons (loading.tsx): PageSkeleton · PageHeadingSkeleton · CardSkeleton · PanelSkeleton · RowsSkeleton · TableSkeleton">
        <PageSkeleton className="flex flex-col gap-6">
          <PageHeadingSkeleton actions={2} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <CardSkeleton />
            <PanelSkeleton>
              <RowsSkeleton rows={3} />
            </PanelSkeleton>
          </div>
          <TableSkeleton rows={3} />
        </PageSkeleton>
      </Specimen>

      <Specimen name="SectionPlaceholder">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SectionPlaceholder title={t("designSystem.gallery.valuesHeader")} />
          <SectionPlaceholder title={t("common.news")} failed onRetry={() => undefined} />
        </div>
      </Specimen>
    </GallerySection>
  );
}
