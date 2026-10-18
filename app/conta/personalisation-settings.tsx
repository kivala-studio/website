"use client";
import { useState } from "react";
import { useAccount } from "../components/account-provider";
import { usePersonalisation } from "../components/personalisation-provider";
import { Feedback } from "../components/async-state";
export default function PersonalisationSettings() {
  const { privateMode } = useAccount();
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
      <Feedback message={message} error={failure} />
    </section>
  );
}
