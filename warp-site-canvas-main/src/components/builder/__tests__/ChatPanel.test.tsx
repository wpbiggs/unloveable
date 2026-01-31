import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPanel from '../ChatPanel';
import { QuestionSpec } from '@/lib/question-extract';
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { Message } from "@/lib/ai-config";

// Mock UI components that might cause issues in test environment
vi.mock('@/components/ui/button', () => ({
  Button: (props: ComponentPropsWithoutRef<"button">) => <button {...props} />
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/progress', () => ({
    Progress: () => <div data-testid="progress-mock" />
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('ChatPanel', () => {
  it('does not allow submission if required questions are unanswered', () => {
    const questions = {
      items: [
        { id: 'q1', question: 'Required?', type: 'text', required: true },
      ] as QuestionSpec[]
    };
    
    render(
      <ChatPanel 
        messages={[]} 
        onSendMessage={() => {}} 
        isGenerating={false} 
        questions={questions}
        onAnswerQuestions={() => {}}
      />
    );

    const continueBtn = screen.getByRole('button', { name: /continue/i });
    expect(continueBtn).toBeDisabled();
    
    const input = screen.getByPlaceholderText('Your answer');
    fireEvent.change(input, { target: { value: 'Answer' } });
    
    expect(continueBtn).not.toBeDisabled();
  });

  it('validates text length before submitting to AI', () => {
     const onSend = vi.fn();
     // Mock window.alert
     const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

     render(
      <ChatPanel 
        messages={[]} 
        onSendMessage={onSend} 
        isGenerating={false} 
      />
    );
    
    const input = screen.getByPlaceholderText(/Describe what you want to build/i);
    // Find the submit button by its icon or class if name is empty, or just get form directly
    // The previous test used getByRole('button', { name: '' }) which is brittle if we added aria-label
    // Let's rely on the form submission behavior
    const form = input.closest('form');

    // Try sending empty
    fireEvent.change(input, { target: { value: '   ' } });
    if (form) fireEvent.submit(form);
    
    expect(onSend).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith("Please enter a message or attach a file.");
    
    // Try sending valid
    alertMock.mockClear();
    fireEvent.change(input, { target: { value: 'Hello' } });
    if (form) fireEvent.submit(form);
    
    expect(onSend).toHaveBeenCalledWith({ content: 'Hello', files: [] });
    expect(alertMock).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it('validates max text length before submitting', () => {
    const onSend = vi.fn();
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <ChatPanel 
        messages={[]} 
        onSendMessage={onSend} 
        isGenerating={false} 
      />
    );
    
    const input = screen.getByPlaceholderText(/Describe what you want to build/i);
    const form = input.closest('form');

    // Create a very long string > 100,000 chars
    const longText = 'a'.repeat(100001);
    fireEvent.change(input, { target: { value: longText } });
    if (form) fireEvent.submit(form);
    
    expect(onSend).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining("Message is too long"));
    
    alertMock.mockRestore();
  });

  it('shows copy button on user messages and copies text', async () => {
    const messages: Message[] = [{ id: "1", role: "user", content: "User message", timestamp: new Date() }];

    render(
      <ChatPanel 
        messages={messages}
        onSendMessage={() => {}} 
        isGenerating={false} 
      />
    );

    // Hover over the message container to reveal the copy button if hidden, 
    // or just check if it exists in the DOM.
    // Assuming we implement it visible for now or use user-event to hover.
    
    const copyBtn = screen.getByTitle('Copy message');
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('User message');
  });

  it('renders timestamps for messages', () => {
    const now = new Date();
    const messages: Message[] = [{ id: "1", role: "user", content: "User message", timestamp: now }];

    render(
      <ChatPanel 
        messages={messages}
        onSendMessage={() => {}} 
        isGenerating={false} 
      />
    );

    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    expect(screen.getByText(timeString)).toBeInTheDocument();
  });
});
