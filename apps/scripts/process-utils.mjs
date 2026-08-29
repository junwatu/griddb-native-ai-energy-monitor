import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';

export const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} stopped by ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export async function runOrExit(command, args, options = {}) {
  const code = await run(command, args, options);
  if (code !== 0) process.exit(code);
}
