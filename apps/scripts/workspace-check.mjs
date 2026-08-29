import { fileURLToPath } from 'node:url';
import { npmCommand, runOrExit } from './process-utils.mjs';

const appsRoot = fileURLToPath(new URL('..', import.meta.url));

console.log('Checking the native GridDB bridge...');
await runOrExit(npmCommand, ['run', 'check', '--workspace=native-bridge'], {
  cwd: appsRoot,
});

console.log('\nBuilding the dashboard...');
await runOrExit(npmCommand, ['run', 'build', '--workspace=dashboard'], {
  cwd: appsRoot,
});

console.log('\nAll workspace checks passed.');
