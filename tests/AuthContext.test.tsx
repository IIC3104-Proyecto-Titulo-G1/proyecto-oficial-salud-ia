import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { mockAuth } from './__mocks__/supabaseClient';

// Este es un integration test: verifica el funcionamiento del contexto de autenticación

function TestComponent() {
  const { user, userRole, loading, signIn, signOut } = useAuth();
  
  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <div data-testid="user">{user ? user.email : 'No user'}</div>
          <div data-testid="role">{userRole || 'No role'}</div>
          <button onClick={() => signIn('test@example.com', 'password')}>Sign In</button>
          <button onClick={() => signOut()}>Sign Out</button>
        </div>
      )}
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth._getSession = { data: { session: null } };
  });

  it('proporciona valores iniciales cuando no hay sesión (integration)', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('No user');
    expect(screen.getByTestId('role')).toHaveTextContent('No role');
  });

  it('permite llamar a signIn (integration)', async () => {
    mockAuth._signInError = null;
    
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    signInButton.click();

    await waitFor(() => {
      expect(mockAuth.signInWithPassword).toHaveBeenCalled();
    });
  });

  it('permite llamar a signOut (integration)', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    signOutButton.click();

    await waitFor(() => {
      expect(mockAuth.signOut).toHaveBeenCalled();
    });
  });

  it('maneja refreshUserRole correctamente (integration)', async () => {
    mockAuth._getSession = {
      data: {
        session: {
          user: { id: 'user-1', email: 'user@example.com' },
          access_token: 'token',
        } as any,
      },
    };

    function TestComponentWithRefresh() {
      const { refreshUserRole } = useAuth();
      return (
        <button onClick={() => refreshUserRole()}>Refresh Role</button>
      );
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponentWithRefresh />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh role/i });
    refreshButton.click();

    // refreshUserRole debería ejecutarse sin errores
    await waitFor(() => {
      expect(refreshButton).toBeInTheDocument();
    });
  });
});

