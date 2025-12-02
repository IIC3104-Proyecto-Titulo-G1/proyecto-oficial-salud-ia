import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

// Este es un unit test: verifica el renderizado básico de la página 404

describe('NotFound', () => {
  it('renderiza el mensaje 404 correctamente (unit)', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText(/oops! page not found/i)).toBeInTheDocument();
    expect(screen.getByText(/volver al inicio/i)).toBeInTheDocument();
  });

  it('tiene un link que apunta a la raíz (unit)', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /volver al inicio/i });
    expect(link).toHaveAttribute('href', '/');
  });
});

