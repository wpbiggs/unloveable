import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishToGitHub } from '../../../src/lib/github-utils';

// Mock global fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('publishToGitHub', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create a repository and push files', async () => {
    // Mock successful repo creation
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: 'my-site',
        html_url: 'https://github.com/user/my-site',
        default_branch: 'main',
      }),
    });

    // Mock successful file upload (for 2 files)
    // For each file: 
    // 1. GET (check existence) -> 404 Not Found (new file)
    // 2. PUT (upload) -> 200 OK

    // File 1: README.md
    globalFetch.mockResolvedValueOnce({ ok: false, status: 404 }); 
    globalFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); 

    // File 2: index.html
    globalFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    globalFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const files = [
      { path: 'README.md', content: '# Hello' },
      { path: 'index.html', content: '<h1>Hi</h1>' },
    ];

    const result = await publishToGitHub('fake-token', 'my-site', files);

    expect(result).toEqual({
      success: true,
      repoUrl: 'https://github.com/user/my-site',
    });

    // Verify repo creation call
    expect(globalFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/user/repos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'token fake-token',
        }),
        body: JSON.stringify({
          name: 'my-site',
          description: 'Created with UnLoveable',
          auto_init: true, // Important to create initial commit so we can update files
          private: false,
        }),
      })
    );

    // Verify file upload calls (using content API for simplicity in MVP)
    // Note: In reality, for many files, we'd use the Git Data API (Tree/Commit/Ref). 
    // For this MVP step, we'll verify the Content API pattern or just basic existence.
    // We'll implementing a simple loop using PUT /repos/:owner/:repo/contents/:path
    // This requires knowing the owner, which we get from the repo creation response? 
    // Or we assume the token owner. The repo creation response gives us the full url.
    // https://api.github.com/repos/user/my-site/contents/README.md
  });

  it('should handle repo creation failure', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ message: 'Repository already exists' }),
    });

    await expect(publishToGitHub('fake-token', 'existing-repo', [])).resolves.toEqual({
      success: false,
      error: 'Failed to create repository: Repository already exists',
    });
  });
});
