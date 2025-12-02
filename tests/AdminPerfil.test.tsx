import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPerfil from '@/pages/AdminPerfil';

// Este es un integration test: verifica el renderizado y validaciones del perfil de admin

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
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('AdminPerfil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige a login si no es admin (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      userRole: 'medico',
      userRoleData: null,
      loading: false,
      refreshUserRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminPerfil />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('renderiza el formulario cuando es admin (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com' },
      userRole: 'admin',
      userRoleData: {
        id: 'x',
        user_id: 'admin-1',
        role: 'admin',
        nombre: 'Admin User',
        email: 'admin@example.com',
      },
      loading: false,
      refreshUserRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AdminPerfil />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/mi perfil/i)).toBeInTheDocument();
      expect(screen.getByText(/información personal/i)).toBeInTheDocument();
    });
  });
});

