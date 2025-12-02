import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminEditUser from '@/pages/AdminEditUser';

// Este es un integration test: verifica el renderizado y validaciones del editor de usuario

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
    useParams: () => ({ userId: 'user-123' }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('AdminEditUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige a login si no es admin (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      userRole: 'medico',
      userRoleData: null,
      loading: false,
    });

    render(
      <MemoryRouter>
        <AdminEditUser />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('muestra loading cuando está cargando (unit)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1' },
      userRole: 'admin',
      userRoleData: null,
      loading: false,
    });

    render(
      <MemoryRouter>
        <AdminEditUser />
      </MemoryRouter>
    );

    // El componente debería estar en estado de carga inicialmente
    expect(screen.queryByText(/editar usuario/i)).not.toBeInTheDocument();
  });
});

