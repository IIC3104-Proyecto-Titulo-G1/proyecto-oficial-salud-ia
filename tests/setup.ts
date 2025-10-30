import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock de @supabase/supabase-js para toda la suite de tests
vi.mock('@supabase/supabase-js', async () => {
  const mod = await import('./__mocks__/supabaseClient');
  return mod as any;
});

// Mocks globales mínimos cuando jsdom no implementa APIs del navegador
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});


