import { api, utils } from '@electron-forge/core';
import { createJiti } from 'jiti';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(repositoryRoot, 'forge.block6a-certification.config.ts');
const [outFlag, outValue, ...extraArguments] = process.argv.slice(2);
if (outFlag !== '--out-dir' || !outValue || extraArguments.length > 0) {
  throw new Error('Expected --out-dir <unique-certification-staging-directory>.');
}
const outDir = path.resolve(repositoryRoot, outValue);
const jiti = createJiti(import.meta.url);
const loaded = await jiti.import(configPath);
const certificationConfig = loaded.default ?? loaded;

utils.registerForgeConfigForDirectory(repositoryRoot, certificationConfig);
try {
  await api.package({ dir: repositoryRoot, interactive: false, outDir });
} finally {
  utils.unregisterForgeConfigForDirectory(repositoryRoot);
}
