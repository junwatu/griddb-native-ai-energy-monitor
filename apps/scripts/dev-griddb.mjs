import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { npmCommand, readEnvironmentFile, runOrExit } from './process-utils.mjs';

const appsRoot = fileURLToPath(new URL('..', import.meta.url));
const environmentPath = join(appsRoot, 'native-bridge', '.env');

await runOrExit(process.execPath, ['scripts/doctor.mjs'], {
  cwd: appsRoot,
});

console.log('\nStarting the native GridDB connection example...');
console.log('This currently runs the bridge query example; dashboard integration is the next step.\n');
await runOrExit(npmCommand, ['start', '--workspace=native-bridge'], {
  cwd: appsRoot,
  env: { ...readEnvironmentFile(environmentPath), ...process.env },
});
