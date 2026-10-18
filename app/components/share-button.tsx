"use client";
import { useState } from "react";
import Icon from "./invest-icon";
export default function ShareButton({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title, url: location.href });
      else {
        await navigator.clipboard.writeText(location.href);
        setMessage("Ligação copiada.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage(
          "Não foi possível partilhar. Copia a ligação da barra de endereço.",
        );
    }
  }
  return (
    <div className="share-control">
      <button className="secondary-button" onClick={share}>
        <Icon name="share" size={18} />
        Partilhar
      </button>
      <span className="fine-print" role="status">
        {message}
      </span>
    </div>
  );
}
