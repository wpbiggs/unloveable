import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  },
}));

// Mock the Auth component we will build
vi.mock('@/pages/Auth', () => ({
  default: () => <div data-testid="auth-component">Auth Component</div>,
}));

describe('Auth Route', () => {
  it('renders the Auth component on /auth route', async () => {
    window.history.pushState({}, 'Auth Page', '/auth');

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <App />
    );

    // Should find the auth component
    await waitFor(() => {
        expect(screen.getByTestId('auth-component')).toBeInTheDocument();
    });
  });
});
