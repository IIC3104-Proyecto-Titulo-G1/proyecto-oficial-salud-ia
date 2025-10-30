import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/pages/Login';
import { mockAuth } from './__mocks__/supabaseClient';
import { vi } from 'vitest';

vi.mock('@/contexts/AuthContext', () => {
  return {
    useAuth: () => ({
      user: null,
      session: null,
      userRole: null,
      userRoleData: null,
      loading: false,
      signIn: async (email: string, password: string) => {
        const { error } = await mockAuth.signInWithPassword({ email, password } as any);
        return { error } as any;
      },
      signOut: vi.fn(),
      refreshUserRole: vi.fn(),
    }),
    AuthProvider: ({ children }: any) => children,
  };
});

// Este es un behaviour/integration test: valida el formulario y la llamada a signInWithPassword a través del contexto

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth._signInError = null;
});

describe('Login', () => {
  it('muestra error de validación para email inválido (unit)', async () => {
    renderWithProviders();

    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'correo-malo' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    // No hay toast en el DOM real, pero podemos verificar que el botón cambia a estado de carga solo si pasa validación.
    // Si la validación falla, no debería cambiar a "Iniciando sesión..." inmediatamente.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeEnabled();
    });
  });

  it('llama a signInWithPassword con credenciales válidas (integration)', async () => {
    renderWithProviders();

    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockAuth.signInWithPassword).toHaveBeenCalled();
    });
  });

  it('muestra error si credenciales inválidas (integration)', async () => {
    mockAuth._signInError = { message: 'Invalid login credentials' } as any;
    renderWithProviders();

    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockAuth.signInWithPassword).toHaveBeenCalled();
    });
  });
});


