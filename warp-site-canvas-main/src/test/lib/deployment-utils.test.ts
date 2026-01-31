
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deployToVercel } from '../../../src/lib/deployment-utils';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('deployToVercel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deploys the project to Vercel and returns the deployment URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://my-project.vercel.app' }),
    });

    const projectData = { name: 'My Project', files: [] };
    const url = await deployToVercel(projectData);

    expect(fetchMock).toHaveBeenCalledWith('https://api.vercel.com/v13/deployments', expect.objectContaining({
      method: 'POST',
      body: expect.any(String),
    }));
    expect(url).toBe('https://my-project.vercel.app');
  });

  it('throws an error if deployment fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
    });

    const projectData = { name: 'My Project', files: [] };
    
    await expect(deployToVercel(projectData)).rejects.toThrow('Deployment failed: Unauthorized');
  });
});
