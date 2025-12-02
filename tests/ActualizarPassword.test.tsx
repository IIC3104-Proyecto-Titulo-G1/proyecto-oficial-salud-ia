import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActualizarPassword from '@/pages/ActualizarPassword';
import { mockAuth } from './__mocks__/supabaseClient';

// Este es un integration test: valida el formulario y la actualización de contraseña

const mockNavigate = vi.fn();
const mockToast = vi.fn();

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

describe('ActualizarPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth._getSession = {
      data: {
        session: {
          user: { id: 'user-1', email: 'user@example.com' },
          access_token: 'token',
        } as any,
      },
    };
  });

  it('renderiza el formulario correctamente (unit)', () => {
    render(
      <MemoryRouter>
        <ActualizarPassword />
      </MemoryRouter>
    );

    expect(screen.getByText(/actualizar contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it('muestra error si las contraseñas no coinciden (unit)', async () => {
    render(
      <MemoryRouter>
        <ActualizarPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: 'password456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });
  });

  it('muestra error si la contraseña es muy corta (unit)', async () => {
    render(
      <MemoryRouter>
        <ActualizarPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), {
      target: { value: '12345' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });
  });
});

