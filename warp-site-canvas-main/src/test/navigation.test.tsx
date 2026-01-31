import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom'; // Ensure matchers are available

describe('Navigation Links', () => {
  it('renders navigation links with absolute paths to support multi-page navigation', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    // We want these to be absolute paths (starting with /) so they work from /builder etc.
    // Currently they are just #features, which breaks if you are not on home.
    // We expect the href attribute to be exactly '/#features', etc.
    
    const featuresLink = screen.getByText('Features');
    expect(featuresLink).toHaveAttribute('href', '/#features');

    const howItWorksLink = screen.getByText('How it Works');
    expect(howItWorksLink).toHaveAttribute('href', '/#how-it-works');

    const pricingLink = screen.getByText('Pricing');
    expect(pricingLink).toHaveAttribute('href', '/#pricing');
  });
});
