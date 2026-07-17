type ErrorPayload = {
  message?: string;
  detail?: string;
};

export async function readJsonResponse<T>(response: Response, source: string): Promise<T> {
  const body = await response.text();

  if (!body.trim()) {
    throw new Error(`${source} retornou uma resposta vazia (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    const receivedHtml = /^\s*(?:<!doctype\s+html|<html)/i.test(body);
    if (receivedHtml) {
      throw new Error(
        `${source} retornou HTML em vez de JSON (HTTP ${response.status}). Verifique /api/health e confirme a porta 3000 no Easypanel.`,
      );
    }

    throw new Error(`${source} retornou JSON invalido (HTTP ${response.status}).`);
  }
}

export function apiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const error = payload as ErrorPayload;
  return error.message || error.detail || fallback;
}
