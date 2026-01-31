
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CodeEditor from '../components/builder/CodeEditor';
import { OpenCode } from '../lib/opencode-client';
import React from 'react';

// Mock the OpenCode client
vi.mock('../lib/opencode-client', () => ({
  OpenCode: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('CodeEditor', () => {
  const defaultProps = {
    filePath: '/src/components/Test.tsx',
    content: 'original content',
    language: 'typescript',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows editing content', () => {
    render(<CodeEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).not.toHaveAttribute('readonly');
    
    fireEvent.change(textarea, { target: { value: 'edited content' } });
    expect(textarea).toHaveValue('edited content');
  });

  it('shows unsaved changes indicator when content changes', () => {
    render(<CodeEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'edited content' } });
    
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('calls OpenCode.writeFile when save button is clicked', async () => {
    render(<CodeEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'edited content' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    expect(OpenCode.writeFile).toHaveBeenCalledWith('/src/components/Test.tsx', 'edited content');
    
    await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'File saved',
        }));
    });
  });

  it('handles keyboard shortcut for save (Ctrl+S)', async () => {
    render(<CodeEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'edited content' } });
    
    fireEvent.keyDown(textarea, { key: 's', ctrlKey: true });
    
    expect(OpenCode.writeFile).toHaveBeenCalledWith('/src/components/Test.tsx', 'edited content');
  });
});
