
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { componentRegistrySchema } from '../schemas/component-registry';

describe('Component Registry', () => {
  it('should exist and be valid JSON', () => {
    const registryPath = path.resolve(__dirname, '../component-registry.json');
    expect(fs.existsSync(registryPath), 'component-registry.json missing').toBe(true);
    
    const content = fs.readFileSync(registryPath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('should validate against the schema', () => {
    const registryPath = path.resolve(__dirname, '../component-registry.json');
    const content = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    
    const result = componentRegistrySchema.safeParse(content);
    if (!result.success) {
      console.error('Registry validation error:', result.error);
    }
    expect(result.success, 'component-registry.json does not match schema').toBe(true);
  });

  it('should have correct version', () => {
    const registryPath = path.resolve(__dirname, '../component-registry.json');
    const content = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    expect(content.version).toBe('1.0.0');
  });
});
