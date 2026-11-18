"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/ui/cn";
import { AmountField } from "@/ui/components/amount-field";
import { KeyHint, SearchField } from "@/ui/components/controls";
import { INPUT, INPUT_BARE, INPUT_BOX } from "@/ui/components/field-styles";

import { FORCED_FIELD_FOCUS, GallerySection, SPECIMEN_GRID, Specimen, Variant } from "./specimen";

const LABEL = "flex flex-col gap-1 text-secondary font-semibold text-primary-text";

export function Fields() {
  const t = useTranslations();
  const [empty, setEmpty] = useState("");
  const [filled, setFilled] = useState("BAI");
  const [focused, setFocused] = useState("");
  const [amount, setAmount] = useState("");
  const [loss, setLoss] = useState("12 500");
  const [percent, setPercent] = useState("5");

  return (
    <GallerySection id="fields" title="Fields">
      <div className={SPECIMEN_GRID}>
        <Specimen name="SearchField">
          <Variant label='hint="/"' className="items-stretch">
            <SearchField value={empty} onChange={setEmpty} hint="/" />
          </Variant>
          <Variant label="with a value: clear button" className="items-stretch">
            <SearchField value={filled} onChange={setFilled} placeholder={t("common.searchSymbolNameOrIssuer")} />
          </Variant>
          <Variant label="focus: accent border + glow, no outline" className="items-stretch">
            <SearchField value={focused} onChange={setFocused} placeholder={t("common.searchInstruments")} className={FORCED_FIELD_FOCUS} />
          </Variant>
          <Variant label="KeyHint">
            <KeyHint>/</KeyHint>
          </Variant>
        </Specimen>

        <Specimen name="INPUT · INPUT_BOX + INPUT_BARE">
          <label className={LABEL}>
            INPUT
            <input className={cn(INPUT, "font-normal")} placeholder="—" />
          </label>
          <label className={LABEL}>
            INPUT · focus
            <input className={cn(INPUT, FORCED_FIELD_FOCUS, "font-normal")} defaultValue="BAIAAAAA" />
          </label>
          <label className={LABEL}>
            INPUT · disabled
            <input className={cn(INPUT, "font-normal disabled:opacity-42")} defaultValue="BFAAAAAA" disabled />
          </label>
          <label className={LABEL}>
            {"INPUT <select>"}
            <select className={cn(INPUT, "font-normal")} defaultValue="equity">
              <option value="equity">{t("common.stocks")}</option>
              <option value="bond">{t("common.bonds")}</option>
            </select>
          </label>
          <label className={LABEL}>
            INPUT_BOX · suffix
            <span className={INPUT_BOX}>
              <input className={cn(INPUT_BARE, "font-normal")} inputMode="decimal" value={percent} onChange={(event) => setPercent(event.target.value)} />
              <span className="text-body font-normal text-secondary-text">%</span>
            </span>
          </label>
        </Specimen>
      </div>

      <Specimen name="AmountField">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={LABEL}>
            {'suffix="Kz"'}
            <AmountField value={amount} onValueChange={setAmount} suffix="Kz" className="font-normal" />
          </label>
          <label className={LABEL}>
            {'prefix="−" suffix="Kz"'}
            <AmountField value={loss} onValueChange={setLoss} prefix="−" suffix="Kz" className="font-normal" />
          </label>
        </div>
      </Specimen>
    </GallerySection>
  );
}
