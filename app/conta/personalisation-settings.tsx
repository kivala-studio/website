"use client";
import { updateExposure } from "../../lib/content-exposure";
import { useState } from "react";
import { useAccount } from "../components/account-provider";
import { usePersonalisation } from "../components/personalisation-provider";
import { Feedback } from "../components/async-state";
export default function PersonalisationSettings() {
  const { privateMode, client, user } = useAccount();
  const { resetBehavior, error, refresh } = usePersonalisation();
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  return (
    <section className="form-panel">
      <h2>O que te interessa</h2>
      <p>
        A carteira, a lista e os alertas têm prioridade. As consultas de
        instrumentos, escolhas na pesquisa e comparações ajudam a ordenar
        conteúdo, tal como na app.
      </p>
      <p className="fine-print">
        Só sincronizamos contagens por dia e instrumento. Não guardamos termos
        de pesquisa nem montantes nesta actividade. O modo privado pausa o
        registo e a ordenação pessoal.
      </p>
      {privateMode && <p>Personalização em pausa neste dispositivo.</p>}
      {error && (
        <p role="status">
          Não foi possível sincronizar os interesses. O restante conteúdo
          continua disponível.{" "}
          <button className="text-button" onClick={refresh}>
            Tentar novamente
          </button>
        </p>
      )}
      <button
        className="secondary-button"
        onClick={async () => {
          setMessage("");
          setFailure("");
          if (await resetBehavior())
            setMessage(
              "Histórico de interesses reposto neste navegador. As novas acções começam a contar amanhã; a carteira, lista e alertas mantêm a sua prioridade.",
            );
          else
            setFailure(
              "Não foi possível guardar a preferência neste navegador.",
            );
        }}
      >
        Repor interesses neste navegador
      </button>
      <p className="fine-print">
        Esta reposição afecta a ordenação neste navegador. Não elimina os
        contadores da conta nem altera as preferências na app.
      </p>
      <h3>Preferências de utilidade</h3>
      <p className="fine-print">
        As escolhas “Não foi útil” e “Mostrar menos deste tipo” ficam neste
        navegador durante 56 dias. A relevância financeira mantém prioridade.
        Não alteram os teus alertas nem retiram instrumentos da lista.
      </p>
      <button
        className="secondary-button"
        disabled={privateMode}
        onClick={async () => {
          setMessage("");
          setFailure("");
          try {
            if (!client || !user) throw new Error("Account unavailable");
            await updateExposure(
              user.id,
              async () => {
                const { data } = await client.auth.getSession();
                return data.session?.user.id === user.id;
              },
              (old) => ({ ...old, feedback: [] }),
            );
            setMessage("Preferências de utilidade repostas neste navegador.");
          } catch {
            setFailure(
              "Não foi possível repor as preferências. Tenta novamente.",
            );
          }
        }}
      >
        Repor preferências de utilidade
      </button>
      <Feedback message={message} error={failure} />
    </section>
  );
}
