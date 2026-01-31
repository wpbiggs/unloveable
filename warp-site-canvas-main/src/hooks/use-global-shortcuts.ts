import { useHotkeys } from 'react-hotkeys-hook';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

interface UseGlobalShortcutsProps {
  onSave?: () => void;
  onSendMessage?: () => void;
  onToggleCommandPalette?: () => void;
  onToggleSidebar?: () => void;
}

export const useGlobalShortcuts = ({
  onSave,
  onSendMessage,
  onToggleCommandPalette,
  onToggleSidebar,
}: UseGlobalShortcutsProps) => {
  const { toast } = useToast();

  const handleSave = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave();
    } else {
        // If no handler is provided, we can either do nothing or show a "No save handler" toast.
        // For now, let's just log or ignore.
        // console.log("Save shortcut triggered but no handler provided.");
    }
  }, [onSave]);

  const handleSendMessage = useCallback((e: KeyboardEvent) => {
      if (onSendMessage) {
          e.preventDefault();
          onSendMessage();
      }
  }, [onSendMessage]);

    const handleCommandPalette = useCallback((e: KeyboardEvent) => {
        if (onToggleCommandPalette) {
            e.preventDefault();
            onToggleCommandPalette();
        }
    }, [onToggleCommandPalette]);
    
    const handleSidebar = useCallback((e: KeyboardEvent) => {
        if (onToggleSidebar) {
            e.preventDefault();
            onToggleSidebar();
        }
    }, [onToggleSidebar]);


  // Mod+S (Save)
  useHotkeys('mod+s', handleSave, { enableOnFormTags: true }, [handleSave]);

  // Mod+Enter (Send Message) - usually only enabled when focus is in input, but we can check that in the handler or pass a specific scope/ref if needed. 
  // For now, let's enable it globally but maybe check if a chat input is present? 
  // Actually, standard behavior is often Mod+Enter submits forms. 
  useHotkeys('mod+enter', handleSendMessage, { enableOnFormTags: true }, [handleSendMessage]);

  // Mod+K (Command Palette)
  useHotkeys('mod+k', handleCommandPalette, { enableOnFormTags: true }, [handleCommandPalette]);
  
  // Mod+B (Toggle Sidebar - commonly used in VS Code etc)
  useHotkeys('mod+b', handleSidebar, { enableOnFormTags: true }, [handleSidebar]);
};
