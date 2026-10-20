"use client";

import { useAccount } from "./account-provider";

export default function AppearanceSelect() {
  const { appearance, setAppearance } = useAccount();
  return (
    <label className="theme-select">
      <span>Tema</span>
      <select
        aria-label="Tema"
        value={appearance}
        onChange={(event) => setAppearance(event.target.value)}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
      </select>
    </label>
  );
}
