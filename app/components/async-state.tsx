"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const next = await load();
      if (current === generation.current) setData(next);
    } catch {
      if (current === generation.current)
        setError("Não foi possível carregar os dados. Tenta novamente.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    let active = true;
    // Start external I/O after setup; cleanup invalidates requests on unmount.
    void Promise.resolve().then(() => {
      if (active) void reload();
    });
    const counter = generation;
    return () => {
      active = false;
      counter.current++;
    };
  }, [reload]);
  return { data, error, loading, reload };
}
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (error)
    return (
      <div className="error-state" role="alert">
        {error} <button onClick={retry}>Tentar novamente</button>
      </div>
    );
  if (loading)
    return (
      <p className="loading-state" role="status">
        A carregar…
      </p>
    );
  return null;
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return error ? (
    <p role="alert" className="error-state">
      {error}
    </p>
  ) : message ? (
    <p role="status" className="success-state">
      {message}
    </p>
  ) : null;
}
