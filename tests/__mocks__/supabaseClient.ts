import { vi } from 'vitest';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';

type FromQuery = {
  select: (columns?: string) => FromQuery;
  eq: (col: string, value: any) => FromQuery;
  in: (col: string, values: any[]) => FromQuery;
  order: (col: string, opts?: { ascending?: boolean }) => FromQuery;
  single: () => Promise<{ data: any; error: null } | { data: null; error: any }> | FromQuery;
  delete: () => FromQuery;
  insert?: (value: any) => FromQuery;
};

export const mockAuth = {
  // Configurable respuestas en tests
  _signInError: null as any,
  _getSession: { data: { session: null as Session | null } },
  _onAuthHandlers: [] as Array<(e: string, s: Session | null) => void>,

  signInWithPassword: vi.fn(async (_: { email: string; password: string }) => ({
    data: { user: null as User | null, session: null as Session | null },
    error: mockAuth._signInError,
  })),

  signOut: vi.fn(async () => ({ error: null })),

  signUp: vi.fn(async (_: { email: string; password: string; options?: any }) => ({
    data: { user: { id: 'mock-user-id' } as any, session: null },
    error: null,
  })),

  resetPasswordForEmail: vi.fn(async (_: string) => ({ data: {}, error: null })),

  updateUser: vi.fn(async (_: { password?: string }) => ({
    data: { user: { id: 'user-1' } as any },
    error: null,
  })),

  getSession: vi.fn(async () => mockAuth._getSession),

  onAuthStateChange: vi.fn((cb: (e: string, s: Session | null) => void) => {
    mockAuth._onAuthHandlers.push(cb);
    return { data: { subscription: { unsubscribe: () => {} } } } as any;
  }),
} as const;

function createFromMock(initialData: any[] = []) {
  let data = [...initialData];
  const predicates: Array<(row: any) => boolean> = [];
  let limitCount: number | null = null;

  const getResults = () => {
    let rows = data.filter((row) => predicates.every((p) => p(row)));
    if (typeof limitCount === 'number') {
      rows = rows.slice(0, limitCount);
    }
    return Promise.resolve({ data: rows, error: null });
  };

  const api: any = {
    select: () => api,
    eq: (col: string, value: any) => {
      predicates.push((row) => row[col] === value);
      return api;
    },
    in: (col: string, values: any[]) => {
      predicates.push((row) => values.includes(row[col]));
      return api;
    },
    order: () => api,
    limit: (n: number) => {
      limitCount = n;
      return api;
    },
    delete: () => {
      data = data.filter((row) => !predicates.every((p) => p(row)));
      return api;
    },
    single: async () => {
      const result = await getResults();
      const rows = result.data as any[];
      const one = rows[0] ?? null;
      return one ? { data: one, error: null } : { data: null, error: null };
    },
    maybeSingle: async () => {
      const result = await getResults();
      const rows = result.data as any[];
      const one = rows[0] ?? null;
      return one ? { data: one, error: null } : { data: null, error: null };
    },
    then: (resolve: any, reject?: any) => {
      // Permitir await sobre la cadena - convertir a Promise
      return getResults().then(resolve, reject);
    },
    catch: (reject: any) => {
      return getResults().catch(reject);
    },
  } satisfies FromQuery;

  // Hacer que el objeto sea "thenable" (compatible con await)
  return api;
}

export function createClient(): SupabaseClient {
  // Datos de ejemplo utilizables en tests de integración
  const tables: Record<string, any[]> = {
    casos: [],
    user_roles: [],
    comunicaciones_paciente: [],
    resolucion_caso: [],
    sugerencia_ia: [],
  };

  return {
    // @ts-expect-error mock parcial suficiente para tests
    auth: mockAuth,
    channel: (_: string) => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    removeChannel: (_: any) => ({}),
    from(table: string) {
      const data = tables[table] ?? [];
      return createFromMock(data);
    },
  } as unknown as SupabaseClient;
}

export default { createClient };


