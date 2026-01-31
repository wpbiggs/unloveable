
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Header from '../components/Header';
import CTASection from '../components/CTASection';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Toaster } from "@/components/ui/sonner";

// Mock toast to verify "Watch Demo" action
vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    toast: {
      info: vi.fn(),
    }
  };
});

import { toast } from "sonner";

describe('CTA Navigation', () => {
  it('navigates to /builder when "Get Started" header button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Header />} />
          <Route path="/builder" element={<div data-testid="builder-page">Builder Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const getStartedBtn = screen.getByText('Get Started');
    fireEvent.click(getStartedBtn);

    expect(screen.getByTestId('builder-page')).toBeInTheDocument();
  });

  it('navigates to /auth when "Sign In" header button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Header />} />
          <Route path="/auth" element={<div data-testid="auth-page">Auth Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const signInBtn = screen.getByText('Sign In');
    fireEvent.click(signInBtn);

    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
  });

  it('navigates to /builder when "Start Building Free" CTA button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<CTASection />} />
          <Route path="/builder" element={<div data-testid="builder-page">Builder Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const startBuildingBtn = screen.getByText('Start Building Free');
    fireEvent.click(startBuildingBtn);

    expect(screen.getByTestId('builder-page')).toBeInTheDocument();
  });

  it('shows a toast when "Watch Demo" CTA button is clicked', () => {
    render(
      <MemoryRouter>
        <CTASection />
        <Toaster />
      </MemoryRouter>
    );

    const watchDemoBtn = screen.getByText('Watch Demo');
    fireEvent.click(watchDemoBtn);

    expect(toast.info).toHaveBeenCalledWith("Demo video coming soon!");
  });
});
