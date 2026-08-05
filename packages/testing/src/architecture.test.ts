import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const genericPackages = ['protocol', 'core', 'runtime', 'browser', 'testing'];

describe('generic package boundaries', () => {
  it('keeps Angular dependencies out of the ADP implementation', async () => {
    for (const name of genericPackages) {
      const directory = join(process.cwd(), 'packages', name, 'src');
      for (const file of (await readdir(directory)).filter(file => file.endsWith('.ts') && file !== 'architecture.test.ts')) {
        const source = await readFile(join(directory, file), 'utf8');
        expect(source, `${name}/${file}`).not.toMatch(/from ['"](?:@angular\/|@agent-devtools\/internal-angular-)/);
      }
    }
  });
});
