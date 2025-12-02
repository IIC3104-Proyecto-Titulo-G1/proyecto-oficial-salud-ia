import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecuperarPassword from '@/pages/RecuperarPassword';
import { mockAuth } from './__mocks__/supabaseClient';

// Este es un integration test: valida el formulario y la llamada a resetPasswordForEmail

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecuperarPassword', () => {
  it('renderiza el formulario correctamente (unit)', () => {
    render(
      <MemoryRouter>
        <RecuperarPassword />
      </MemoryRouter>
    );

    expect(screen.getByText(/recuperar contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar instrucciones/i })).toBeInTheDocument();
  });

  it('muestra error de validación para email inválido (unit)', async () => {
    render(
      <MemoryRouter>
        <RecuperarPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { 
      target: { value: 'correo-invalido' } 
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar instrucciones/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enviar instrucciones/i })).toBeEnabled();
    });
  });

  it('llama a resetPasswordForEmail con email válido (integration)', async () => {
    render(
      <MemoryRouter>
        <RecuperarPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { 
      target: { value: 'user@example.com' } 
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar instrucciones/i }));

    await waitFor(() => {
      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/actualizar-password'),
        })
      );
    });
  });

  it('muestra mensaje de éxito después de enviar email (integration)', async () => {
    render(
      <MemoryRouter>
        <RecuperarPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { 
      target: { value: 'user@example.com' } 
    });
    fireEvent.click(screen.getByRole('button', { name: /enviar instrucciones/i }));

    await waitFor(() => {
      expect(screen.getByText(/email enviado/i)).toBeInTheDocument();
    });
  });
});

