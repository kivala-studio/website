"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/ui/components/buttons";
import { Dialog } from "@/ui/components/dialog";

/**
 * "Eliminar conta" and its confirmation (iOS account management). Confirming posts a plain form: the server
 * deletes (or, for Apple-linked accounts, sends the browser to Apple) and answers with the next page, so
 * nothing here can claim a result the server did not give. The form names the account that was confirmed.
 */
export function DeleteAccount({ userID, email, apple }: { userID: string; email: string | null; apple: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  return (
    <>
      <Button kind="destructive" className="sm:w-auto sm:self-start" onClick={() => setOpen(true)} data-testid="delete-account">
        {t("common.deleteAccount")}
      </Button>
      {open ? (
        <Dialog
          variant="dialog"
          open
          onClose={() => {
            if (!submitting) setOpen(false);
          }}
          title={t("settings.deleteAccount.confirmationTitle")}
          footer={
            <form
              method="post"
              action={apple ? "/api/account/apple-deletion/start" : "/api/account/delete"}
              onSubmit={() => setSubmitting(true)}
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="account" value={userID} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" kind="destructive" loading={submitting} data-testid="confirm-delete">
                {submitting ? t("settings.deleteAccount.progress") : t("settings.deleteAccount.confirmButton")}
              </Button>
              <Button kind="secondary" disabled={submitting} onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
            </form>
          }
        >
          <p className="text-body text-primary-text">{t("settings.deleteAccount.confirmationMessage", { arg1: email ?? "" })}</p>
          {apple ? <p className="text-body text-primary-text">{t("site.deletion.appleConfirm")}</p> : null}
        </Dialog>
      ) : null}
    </>
  );
}
