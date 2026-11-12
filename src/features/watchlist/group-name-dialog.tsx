"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { GROUP_NAME_LIMIT, groupName } from "@/domain/account/watchlist-ordering";
import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";

/** `Novo grupo` / `Mudar nome`: a trimmed name of 1–40 characters. Mounted while naming. */
export function GroupNameDialog({
  naming,
  onClose,
  onSave,
}: {
  naming: { mode: "new" } | { mode: "rename"; name: string };
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const t = useTranslations();
  const id = useId();
  const [text, setText] = useState(naming.mode === "rename" ? naming.name : "");
  const name = groupName(text);
  return (
    <Dialog
      variant="dialog"
      open
      onClose={onClose}
      title={t(naming.mode === "rename" ? "watchlist.groups.rename" : "watchlist.groups.new")}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button kind="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={!name} data-testid="save-group">
            {t("watchlist.groups.save")}
          </Button>
        </div>
      }
    >
      <form
        id={`${id}-form`}
        onSubmit={(event) => {
          event.preventDefault();
          if (name) onSave(name);
        }}
      >
        <label htmlFor={id} className="mb-2 block text-secondary text-secondary-text">
          {t("common.name")}
        </label>
        <input
          id={id}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={GROUP_NAME_LIMIT}
          autoComplete="off"
          data-autofocus
          data-testid="group-name"
          className="min-h-11 w-full rounded-medium bg-elevated-background px-3 text-body text-primary-text outline-none focus:outline-2 focus:outline-accent"
        />
      </form>
    </Dialog>
  );
}
