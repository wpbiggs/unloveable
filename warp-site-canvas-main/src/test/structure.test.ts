
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Project Structure Invariants', () => {
  it('should maintain required component wrapper folders', () => {
    // These folders are required by the "Component registry contract"
    const componentsDir = path.resolve(__dirname, '../components');
    const requiredWrappers = ['ui', 'patterns', 'brand'];

    requiredWrappers.forEach(dir => {
      const fullPath = path.join(componentsDir, dir);
      
      // Check existence
      expect(fs.existsSync(fullPath), `Required wrapper folder '${dir}' is missing in src/components/`).toBe(true);
      
      // Check it is a directory
      expect(fs.statSync(fullPath).isDirectory(), `'src/components/${dir}' must be a directory`).toBe(true);
      
      // Ensure it's not empty (placeholder check - at least one file or subdirectory should likely exist, or at least .gitkeep)
      // For now, just existence is the primary requirement of the task.
    });
  });
});
