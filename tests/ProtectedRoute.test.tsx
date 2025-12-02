import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Este es un integration test: verifica la protección de rutas según autenticación y roles

const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: any) => children,
}));

function TestPage() {
  return <div>Protected Content</div>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra loading cuando está cargando (unit)', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userRole: null,
      loading: true,
    });

    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/test" element={<TestPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/validando sesión/i)).toBeInTheDocument();
    });
  });

  it('redirige a login si no hay usuario (integration)', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userRole: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/test" element={<TestPage />} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/login page/i)).toBeInTheDocument();
  });

  it('permite acceso si hay usuario autenticado (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      userRole: 'medico',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/test" element={<TestPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    });
  });

  it('bloquea acceso si el rol no está permitido (integration)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      userRole: 'medico',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/test" element={<TestPage />} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  it('permite acceso si el rol está permitido (integration)', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com' },
      userRole: 'admin',
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/test']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/test" element={<TestPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    });
  });
});

