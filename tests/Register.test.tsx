import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminUsuarios from '@/pages/AdminUsuarios';
import { mockAuth } from './__mocks__/supabaseClient';

// Este es un integration/behaviour test: verifica validaciones básicas y que se conecte a Supabase (signUp)

vi.mock('@/contexts/AuthContext', () => {
  return {
    useAuth: () => ({
      user: { id: 'admin-1' },
      userRole: 'admin',
      userRoleData: { nombre: 'Admin', user_id: 'admin-1', role: 'admin', email: 'admin@example.com', id: 'x' },
      loading: false,
      signOut: vi.fn(),
      refreshUserRole: vi.fn(),
    }),
    AuthProvider: ({ children }: any) => children,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth._signInError = null;
});

describe('Register (AdminUsuarios crear usuario)', () => {
  it('abre modal y valida campos requeridos (unit)', async () => {
    render(
      <MemoryRouter>
        <AdminUsuarios />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }));

    // Intenta crear sin llenar, debería seguir mostrando el modal
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    // Verificamos el título del modal (evita colisión con el botón del header)
    expect(await screen.findByRole('heading', { name: /nuevo usuario/i })).toBeInTheDocument();
  });

  it('llama a supabase.auth.signUp al crear usuario (integration)', async () => {
    // Mock de signUp
    const signUpSpy = vi.spyOn(mockAuth, 'signUp' as any).mockResolvedValueOnce({
      data: { user: { id: 'new-user' } },
      error: null,
    } as any);

    render(
      <MemoryRouter>
        <AdminUsuarios />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }));

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Juan Pérez' } });
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'juan@example.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => {
      expect(signUpSpy).toHaveBeenCalled();
    });
  });
});


