"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccount } from "../components/account-provider";
import { Feedback } from "../components/async-state";
import { clearAccountLocalData } from "../../lib/clear-account-local-data";
import { finishDeletedAccount } from "../../lib/account-cleanup";
export default function AppleDeletionResult() {
  const params = useSearchParams(),
    router = useRouter();
  const { client } = useAccount();
  const result = params.get("appleDeletion");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const complete = useCallback(
    async (active: () => boolean) => {
      if (!client || result !== "verified") return;
      try {
        const response = await fetch("/api/account/apple-deletion/result", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unverified result");
        const verified = await response.json();
        if (!active()) return;
        if (verified.outcome === "deleted")
          await finishDeletedAccount(
            client,
            verified.userID,
            clearAccountLocalData,
          );
        if (!active()) return;
        const ack = await fetch("/api/account/apple-deletion/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attempt: verified.attempt }),
        });
        if (!ack.ok) throw new Error("Result acknowledgement failed");
        setError("");
        setMessage(
          verified.outcome === "deleted"
            ? "Conta eliminada. Os dados locais desta conta foram removidos deste navegador."
            : verified.outcome === "cancelled"
              ? "Eliminação cancelada. A conta e os dados locais foram mantidos."
              : "Não foi possível concluir a eliminação. Volta a iniciar a autorização Apple para tentar novamente.",
        );
        router.replace("/conta");
      } catch {
        if (active())
          setError(
            "Não foi possível confirmar o resultado ou concluir a limpeza local. Tenta novamente.",
          );
      }
    },
    [client, result, router],
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void complete(() => active);
    });
    return () => {
      active = false;
    };
  }, [complete, retry]);
  return (
    <>
      <Feedback
        message={message}
        error={
          result === "invalid"
            ? "Esta confirmação expirou ou não pertence a este navegador. Não alterámos os dados locais. Volta a iniciar a eliminação pela tua conta."
            : error
        }
      />
      {error && (
        <button
          className="secondary-button"
          onClick={() => setRetry(retry + 1)}
        >
          Tentar concluir
        </button>
      )}
    </>
  );
}
