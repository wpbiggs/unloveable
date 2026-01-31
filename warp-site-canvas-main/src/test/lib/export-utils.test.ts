
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportAsZip, exportFile } from '../../../src/lib/export-utils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

// Mock jszip
// JSZip is a class, so we need to mock it carefully
const mockFolder = vi.fn();
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip content']));

vi.mock('jszip', () => {
  return {
    default: vi.fn(function() {
      return {
        folder: mockFolder,
        file: mockFile,
        generateAsync: mockGenerateAsync,
      };
    }),
  };
});

describe('export-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock returns for chaining
    mockFolder.mockReturnValue({
      file: mockFile,
    });
  });

  describe('exportAsZip', () => {
    it('should create a zip file with correct structure', async () => {
      const files = {
        html: '<div><h1>Hello</h1></div>', // Fragment (will be wrapped)
        css: 'body { color: red; }',
        js: 'console.log("hello");',
      };
      
      await exportAsZip(files, 'Test Project');
      
      // Verify JSZip was instantiated
      expect(JSZip).toHaveBeenCalled();
      
      // Verify folders were created
      expect(mockFolder).toHaveBeenCalledWith('src');
      expect(mockFolder).toHaveBeenCalledWith('styles');
      expect(mockFolder).toHaveBeenCalledWith('scripts');
      
      // Verify files were added to zip
      
      // Check for standalone index.html - should be wrapped since input was a fragment
      expect(mockFile).toHaveBeenCalledWith('index.html', expect.stringContaining('<!DOCTYPE html>'));
      expect(mockFile).toHaveBeenCalledWith('README.md', expect.stringContaining('# Test Project'));
      
      // Verify generateAsync was called
      expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
      
      // Verify saveAs was called
      expect(saveAs).toHaveBeenCalled();
      const saveAsCall = vi.mocked(saveAs).mock.calls[0];
      expect(saveAsCall[1]).toMatch(/test-project-\d+\.zip/);
    });

    it('should create a workspace zip from file list', async () => {
      const { exportWorkspaceZip } = await import('../../../src/lib/export-utils');
      
      const files = [
        { path: 'package.json', content: '{}' },
        { path: 'src/App.tsx', content: 'console.log("app")' },
        { path: 'public/vite.svg', content: 'svg-data' }
      ];

      await exportWorkspaceZip(files, 'My Workspace');

      expect(JSZip).toHaveBeenCalled();
      // Should add files directly
      expect(mockFile).toHaveBeenCalledWith('package.json', '{}');
      expect(mockFile).toHaveBeenCalledWith('src/App.tsx', 'console.log("app")');
      expect(mockFile).toHaveBeenCalledWith('public/vite.svg', 'svg-data');
      
      expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
      expect(saveAs).toHaveBeenCalled();
    });

    it('should handle missing CSS/JS gracefully', async () => {
       const files = {
        html: '<html><body><h1>Hello</h1></body></html>',
        css: '',
        js: '',
      };

      await exportAsZip(files, 'Simple');
       // Verify we didn't crash and still generated a zip
       expect(mockGenerateAsync).toHaveBeenCalled();
       expect(saveAs).toHaveBeenCalled();
    });

    it('should normalize file paths (remove leading / and ./)', async () => {
      const { exportWorkspaceZip } = await import('../../../src/lib/export-utils');
      
      const files = [
        { path: '/absolute/path.txt', content: 'content1' },
        { path: './relative/path.txt', content: 'content2' },
        { path: 'normal/path.txt', content: 'content3' }
      ];

      await exportWorkspaceZip(files, 'Path Test');

      expect(mockFile).toHaveBeenCalledWith('absolute/path.txt', 'content1');
      expect(mockFile).toHaveBeenCalledWith('relative/path.txt', 'content2');
      expect(mockFile).toHaveBeenCalledWith('normal/path.txt', 'content3');
    });

    it('should handle base64 encoded files correctly', async () => {
      const { exportWorkspaceZip } = await import('../../../src/lib/export-utils');
      
      const files = [
        { path: 'image.png', content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', encoding: 'base64' as const }
      ];

      await exportWorkspaceZip(files, 'Binary Project');

      expect(JSZip).toHaveBeenCalled();
      // JSZip.file should be called with base64: true option for base64 content
      expect(mockFile).toHaveBeenCalledWith('image.png', files[0].content, { base64: true });
      
      expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
      expect(saveAs).toHaveBeenCalled();
    });
  });
  
  describe('exportFile', () => {
      it('should save a single file', () => {
          exportFile('content', 'test.txt', 'text/plain');
          expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'test.txt');
      });
  });
});
