import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { npmCommand, runOrExit } from './process-utils.mjs';

const appsRoot = fileURLToPath(new URL('..', import.meta.url));
const environmentPath = join(appsRoot, 'native-bridge', '.env');

function readEnvironmentFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          value.length >= 2
          && ((value.startsWith("'") && value.endsWith("'"))
            || (value.startsWith('"') && value.endsWith('"')))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
}

await runOrExit(process.execPath, ['scripts/doctor.mjs'], {
  cwd: appsRoot,
});

console.log('\nStarting the native GridDB connection example...');
console.log('This currently runs the bridge query example; dashboard integration is the next step.\n');
await runOrExit(npmCommand, ['start', '--workspace=native-bridge'], {
  cwd: appsRoot,
  env: { ...readEnvironmentFile(environmentPath), ...process.env },
});
