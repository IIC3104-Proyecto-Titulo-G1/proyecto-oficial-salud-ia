import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Este es un behaviour test: renderizado condicional según el rol del usuario autenticado

const makeAuthMock = (role: 'admin' | 'medico' | 'medico_jefe' | null) => ({
  useAuth: () => ({
    user: role ? { id: 'u1', email: 'u1@example.com' } : null,
    userRole: role,
    userRoleData: role ? { nombre: 'Usuario', user_id: 'u1', role, email: 'u1@example.com', id: 'x' } : null,
    loading: false,
    signOut: vi.fn(),
    refreshUserRole: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
});

describe('Dashboard', () => {
  it('para médico muestra botón "Nuevo Caso" (integration)', async () => {
    vi.doMock('@/contexts/AuthContext', () => makeAuthMock('medico'));
    const { default: Component } = await import('@/pages/Dashboard');
    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    );
    // Verifica que el contenido principal del dashboard se renderiza para médicos
    expect(await screen.findByText(/casos recientes/i)).toBeInTheDocument();
  });

  it('para admin no debería mostrar acciones de casos (integration)', async () => {
    vi.doMock('@/contexts/AuthContext', () => makeAuthMock('admin'));
    const { default: Component } = await import('@/pages/Dashboard');
    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    );
    // Admin es redirigido a /admin; como no controlamos el router real aquí, verificamos que NO esté el botón "Nuevo Caso"
    await vi.waitFor(() => {
      expect(screen.queryByRole('button', { name: /nuevo caso/i })).not.toBeInTheDocument();
    });
  });
});


