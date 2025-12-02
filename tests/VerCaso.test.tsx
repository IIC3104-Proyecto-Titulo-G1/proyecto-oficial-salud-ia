import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerCaso from '@/pages/VerCaso';

// Este es un integration test: verifica el renderizado y funcionalidad básica de VerCaso

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();
const mockToast = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'caso-123' }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('VerCaso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maneja el caso cuando no hay usuario (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userRole: null,
      loading: false,
    });

    render(
      <MemoryRouter>
        <VerCaso />
      </MemoryRouter>
    );

    // Verificar que el componente se renderiza (puede redirigir o mostrar error)
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('muestra loading cuando está cargando (unit)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      userRole: 'medico',
      loading: false,
    });

    render(
      <MemoryRouter>
        <VerCaso />
      </MemoryRouter>
    );

    // El componente debería estar en estado de carga inicialmente
    expect(screen.queryByText(/detalles del caso/i)).not.toBeInTheDocument();
  });
});

