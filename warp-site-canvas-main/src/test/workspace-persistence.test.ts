import { OpenCodeWorkspace } from '../lib/opencode-workspace';

describe('OpenCodeWorkspace Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('should persist project ID', () => {
    const projectID = 'test-project-123';
    OpenCodeWorkspace.project.set(projectID);
    expect(OpenCodeWorkspace.project.get()).toBe(projectID);
    expect(localStorage.getItem('opencode.workspace.projectID')).toBe(projectID);
  });

  test('should handle null project ID', () => {
    OpenCodeWorkspace.project.set('temp');
    OpenCodeWorkspace.project.set(null);
    expect(OpenCodeWorkspace.project.get()).toBeNull();
    expect(localStorage.getItem('opencode.workspace.projectID')).toBeNull();
  });

  test('should persist recent projects list', () => {
    const projects = ['/path/to/p1', '/path/to/p2'];
    OpenCodeWorkspace.recent.set(projects);
    expect(OpenCodeWorkspace.recent.get()).toEqual(projects);
    expect(JSON.parse(localStorage.getItem('opencode.workspace.recent') || '[]')).toEqual(projects);
  });

  test('should add unique projects to recent list', () => {
    OpenCodeWorkspace.recent.add('/path/to/p1');
    OpenCodeWorkspace.recent.add('/path/to/p2');
    OpenCodeWorkspace.recent.add('/path/to/p1'); // Duplicate
    expect(OpenCodeWorkspace.recent.get()).toEqual(['/path/to/p1', '/path/to/p2']);
  });

  test('should move existing project to top when added again', () => {
    OpenCodeWorkspace.recent.set(['/path/to/p1', '/path/to/p2']);
    OpenCodeWorkspace.recent.add('/path/to/p2');
    expect(OpenCodeWorkspace.recent.get()).toEqual(['/path/to/p2', '/path/to/p1']);
  });

  test('should remove projects from recent list', () => {
    OpenCodeWorkspace.recent.set(['/path/to/p1', '/path/to/p2']);
    OpenCodeWorkspace.recent.remove('/path/to/p1');
    expect(OpenCodeWorkspace.recent.get()).toEqual(['/path/to/p2']);
  });

  test('should clear empty project ID strings', () => {
    OpenCodeWorkspace.project.set('  ');
    expect(OpenCodeWorkspace.project.get()).toBeNull();
    expect(localStorage.getItem('opencode.workspace.projectID')).toBeNull();
  });
});
