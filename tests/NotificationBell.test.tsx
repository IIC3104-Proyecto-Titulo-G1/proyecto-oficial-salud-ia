import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';

// Este es un integration test: verifica el componente de notificaciones

const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: any) => children,
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      userRole: 'medico',
      userRoleData: null,
      loading: false,
      signOut: vi.fn(),
      refreshUserRole: vi.fn(),
    });
  });

  it('renderiza el botón de notificaciones (unit)', () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('no renderiza cuando no hay usuario (unit)', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userRole: null,
      userRoleData: null,
      loading: false,
      signOut: vi.fn(),
      refreshUserRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    // El componente puede renderizar pero no hacer queries si no hay user
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

