export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";
export type ApiError = Error & { status?: number; details?: unknown };
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const multipart = init.body instanceof FormData;
  const run = (token?: string) =>
    fetch(API_URL + path, {
      ...init,
      headers: {
        ...(!multipart ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  let response = await run(localStorage.getItem("token") ?? undefined);
  if (
    response.status === 401 &&
    localStorage.getItem("refreshToken") &&
    !path.startsWith("/auth/")
  ) {
    const refreshed = await fetch(API_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: localStorage.getItem("refreshToken"),
      }),
    });
    if (refreshed.ok) {
      const session = await refreshed.json();
      localStorage.setItem("token", session.accessToken);
      response = await run(session.accessToken);
    } else {
      localStorage.clear();
      location.assign("/login");
    }
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      Array.isArray(body?.message)
        ? body.message.join(", ")
        : body?.message || "Não foi possível concluir a operação",
    ) as ApiError;
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body as T;
}
export async function download(path: string, filename: string) {
  const response = await fetch(API_URL + path, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
  });
  if (!response.ok) throw new Error("Falha ao gerar arquivo");
  const blob = await response.blob(),
    link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
