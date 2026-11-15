import { useSyncExternalStore } from "react";

let logged = false;
const listeners = new Set<() => void>();
export function setSession(value: boolean) {
  logged = value;
  listeners.forEach((listener) => listener());
}
export function useSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => logged,
  );
}
export async function api(path: string, method = "GET", data?: unknown) {
  const response = await fetch("/api/" + path, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (response.status === 401) setSession(false);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Ошибка сервера");
  return body;
}
export async function checkSession() {
  try {
    await api("auth/session");
    setSession(true);
  } catch {
    setSession(false);
  }
}
