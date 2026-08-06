import { appendFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { publicPackages } from './release-packages.mjs';

const unpublished = [];
const published = [];
const expectedRepository = 'https://github.com/RSamaium/agent-devtools.git';

const view = specifier => {
  const result = spawnSync('npm', ['view', specifier, 'name', 'version', 'repository.url', '--json'], { encoding: 'utf8' });
  if (result.status === 0) return { found: true, value: JSON.parse(result.stdout) };
  if (`${result.stdout}\n${result.stderr}`.includes('E404')) return { found: false };
  throw new Error(`Could not query ${specifier}: ${result.stderr.trim() || result.stdout.trim()}`);
};

const repositoryOf = value => value?.['repository.url'] ?? value?.repository?.url;
const normalizeRepository = value => String(value ?? '').replace(/^git\+/, '').replace(/\/$/, '');

for (const [expectedName, directory] of publicPackages) {
  const manifest = JSON.parse(await readFile(new URL(`../${directory}/package.json`, import.meta.url), 'utf8'));
  if (manifest.name !== expectedName) throw new Error(`Expected ${expectedName} in ${directory}, found ${manifest.name}`);

  const specifier = `${manifest.name}@${manifest.version}`;
  const exact = view(specifier);
  if (exact.found) {
    const repository = repositoryOf(exact.value);
    if (normalizeRepository(repository) !== normalizeRepository(expectedRepository)) throw new Error(`${specifier} already belongs to ${repository || 'a package without repository metadata'}`);
    published.push(specifier);
    continue;
  }

  const latest = view(manifest.name);
  if (latest.found) {
    const repository = repositoryOf(latest.value);
    if (normalizeRepository(repository) !== normalizeRepository(expectedRepository)) throw new Error(`${manifest.name} already belongs to ${repository || 'a package without repository metadata'}`);
  }
  unpublished.push(specifier);
}

const status = { shouldPublish: unpublished.length > 0, unpublished, published };
console.log(JSON.stringify(status, null, 2));

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `should_publish=${status.shouldPublish}\npackages=${JSON.stringify(unpublished)}\n`);
}
