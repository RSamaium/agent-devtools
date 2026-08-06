import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { publicPackages } from './release-packages.mjs';

const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp(join(tmpdir(), 'agent-devtools-release-'));
const repositoryUrl = 'git+https://github.com/RSamaium/agent-devtools.git';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
};

const dependencySections = ['dependencies', 'optionalDependencies', 'peerDependencies'];
const exportedTargets = value => {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(exportedTargets);
};

try {
  const manifests = [];
  for (const [expectedName, directory] of publicPackages) {
    const manifest = JSON.parse(await readFile(join(root, directory, 'package.json'), 'utf8'));
    if (manifest.name !== expectedName) throw new Error(`Expected ${expectedName} in ${directory}, found ${manifest.name}`);
    if (manifest.private) throw new Error(`${manifest.name} must be public`);
    if (manifest.repository?.url !== repositoryUrl || manifest.repository?.directory !== directory) throw new Error(`${manifest.name} has invalid repository metadata`);
    if (manifest.publishConfig?.access !== 'public' || manifest.publishConfig?.registry !== 'https://registry.npmjs.org/') throw new Error(`${manifest.name} has invalid publishConfig`);
    manifests.push(manifest);
  }

  const versions = new Set(manifests.map(manifest => manifest.version));
  if (versions.size !== 1) throw new Error(`Public package versions must stay aligned: ${[...versions].join(', ')}`);

  const archives = [];
  for (const [, directory] of publicPackages) {
    const before = new Set(await readdir(temp));
    run('pnpm', ['--dir', directory, 'pack', '--pack-destination', temp]);
    const archive = (await readdir(temp)).find(file => file.endsWith('.tgz') && !before.has(file));
    if (!archive) throw new Error(`pnpm pack did not create an archive for ${directory}`);
    archives.push(join(temp, archive));
  }

  for (const archive of archives) {
    const packedManifest = JSON.parse(run('tar', ['-xOf', archive, 'package/package.json']));
    const listing = new Set(run('tar', ['-tzf', archive]).trim().split('\n'));
    if (!listing.has('package/CHANGELOG.md')) throw new Error(`${packedManifest.name} does not include its changelog`);
    const dependencies = dependencySections.flatMap(section => Object.entries(packedManifest[section] ?? {}));
    for (const [name, version] of dependencies) {
      if (String(version).startsWith('workspace:')) throw new Error(`${packedManifest.name} still contains workspace protocol for ${name}`);
      if (name.startsWith('@adp-devtools/internal-')) throw new Error(`${packedManifest.name} exposes private dependency ${name}`);
    }

    const targets = [packedManifest.bin, packedManifest.exports].flatMap(exportedTargets);
    for (const target of targets) {
      const path = `package/${target.replace(/^\.\//, '')}`;
      if (!listing.has(path)) throw new Error(`${packedManifest.name} references missing packed file ${target}`);
    }

    for (const path of listing) {
      if (!path.endsWith('.js')) continue;
      const source = run('tar', ['-xOf', archive, path]);
      if (source.includes('@adp-devtools/internal-')) throw new Error(`${packedManifest.name} bundle ${path} references a private package`);
    }
  }

  await writeFile(join(temp, 'package.json'), JSON.stringify({ private: true }));
  run('npm', ['install', '--ignore-scripts', '--legacy-peer-deps', '--package-lock=false', ...archives], { cwd: temp });
  const cli = join(temp, 'node_modules', '.bin', 'agent-devtools');
  const mcp = join(temp, 'node_modules', '.bin', 'agent-devtools-mcp');
  const help = JSON.parse(run(cli, ['help', '--json'], { cwd: temp }));
  if (help.name !== 'agent-devtools') throw new Error('Installed CLI help did not identify agent-devtools');
  const mcpResult = spawnSync(mcp, [], { cwd: temp, encoding: 'utf8' });
  if (mcpResult.status !== 1 || !mcpResult.stderr.includes('AGENT_DEVTOOLS_CDP_URL is required')) throw new Error('Installed MCP binary did not start as expected');

  console.log(`Validated ${archives.length} publishable packages at version ${[...versions][0]}.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
