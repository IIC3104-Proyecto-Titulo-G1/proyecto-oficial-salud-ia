import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Index from '@/pages/Index';

// Este es un unit test: verifica el renderizado básico de la página de inicio

describe('Index', () => {
  it('renderiza el mensaje de bienvenida correctamente (unit)', () => {
    render(<Index />);

    expect(screen.getByText(/welcome to your blank app/i)).toBeInTheDocument();
    expect(screen.getByText(/start building your amazing project here!/i)).toBeInTheDocument();
  });
});

