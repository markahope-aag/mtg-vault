import { vi } from "vitest";

export function createDbMock() {
  const execute = vi.fn().mockResolvedValue([]);
  const returning = vi.fn().mockResolvedValue([{ id: "mock-id" }]);
  const values = vi.fn().mockReturnValue({ returning, onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) });
  const insert = vi.fn().mockReturnValue({ values });
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const del = vi.fn().mockReturnValue({ where });
  const limit = vi.fn().mockResolvedValue([]);
  const from = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) });
  const select = vi.fn().mockReturnValue({ from });
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ execute, insert, update, select }),
  );

  return {
    db: { execute, insert, update, select, delete: del, transaction },
    mocks: { execute, insert, values, returning, select, from, limit, where },
  };
}

export function cronRequest(path: string, secret?: string): Request {
  const headers = new Headers();
  if (secret) headers.set("authorization", `Bearer ${secret}`);
  return new Request(`http://localhost${path}`, { headers });
}

export function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}
