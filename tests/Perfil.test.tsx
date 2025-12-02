import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Perfil from '@/pages/Perfil';

// Este es un integration test: verifica el renderizado y funcionalidad básica del perfil

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige a login si no hay usuario (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userRoleData: null,
      loading: false,
      refreshUserRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Perfil />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('renderiza el formulario cuando hay usuario (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      userRoleData: {
        id: 'x',
        user_id: 'user-1',
        role: 'medico',
        nombre: 'Juan Pérez',
        email: 'user@example.com',
        hospital: 'Hospital Test',
        especialidad: 'Cardiología',
      },
      loading: false,
      refreshUserRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Perfil />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/mi perfil/i)).toBeInTheDocument();
    });
  });
});

