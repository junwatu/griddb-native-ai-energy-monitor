import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { commandExists } from './process-utils.mjs';

const appsRoot = fileURLToPath(new URL('..', import.meta.url));
const bridgeRoot = join(appsRoot, 'native-bridge');
const localPython = process.platform === 'win32'
  ? join(bridgeRoot, '.venv', 'Scripts', 'python.exe')
  : join(bridgeRoot, '.venv', 'bin', 'python');
const macJavaHomes = [
  '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
  '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
];
const detectedJavaHome = process.env.JAVA_HOME
  ?? macJavaHomes.find((home) => existsSync(join(home, 'bin', 'java')));
const javaCommand = detectedJavaHome
  ? join(detectedJavaHome, 'bin', 'java')
  : 'java';

const pythonCandidates = [process.env.PYTHON_BIN, localPython, 'python3', 'python']
  .filter(Boolean);
const python = pythonCandidates.find((candidate) => commandExists(candidate));

const checks = [
  ['Node.js 18+', Number(process.versions.node.split('.')[0]) >= 18],
  ['npm', commandExists(process.platform === 'win32' ? 'npm.cmd' : 'npm')],
  ['Python', Boolean(python)],
  ['Java', commandExists(javaCommand)],
  ['Maven', commandExists(process.platform === 'win32' ? 'mvn.cmd' : 'mvn')],
  ['GridDB public JAR', existsSync(join(bridgeRoot, 'lib', 'gridstore.jar'))],
  ['GridDB Arrow JAR', existsSync(join(bridgeRoot, 'lib', 'gridstore-arrow.jar'))],
  ['GridDB Cloud JAR', existsSync(join(bridgeRoot, 'lib', 'gridstore-advanced.jar'))],
  ['Environment file', existsSync(join(bridgeRoot, '.env'))],
];

if (python) {
  const pythonEnvironment = { ...process.env };
  if (detectedJavaHome) {
    pythonEnvironment.JAVA_HOME = detectedJavaHome;
    pythonEnvironment.PATH = `${join(detectedJavaHome, 'bin')}${delimiter}${pythonEnvironment.PATH ?? ''}`;
  }
  if (!pythonEnvironment.JAVA_TOOL_OPTIONS?.includes('java.base/java.nio')) {
    pythonEnvironment.JAVA_TOOL_OPTIONS = [
      pythonEnvironment.JAVA_TOOL_OPTIONS,
      '--add-opens=java.base/java.nio=ALL-UNNAMED',
    ].filter(Boolean).join(' ');
  }
  const imports = spawnSync(
    python,
    [
      '-c',
      'from pathlib import Path; import jpype; jpype.startJVM(classpath=[str(path) for path in Path("lib").glob("*.jar")]); import griddb_python, pyarrow',
    ],
    { cwd: bridgeRoot, env: pythonEnvironment, stdio: 'ignore' },
  );
  checks.push(['Python GridDB runtime', imports.status === 0]);
}

const labelWidth = Math.max(...checks.map(([label]) => label.length));
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'MISS'}  ${label.padEnd(labelWidth)}`);
}

const missing = checks.filter(([, passed]) => !passed);
if (missing.length) {
  console.error(`\n${missing.length} prerequisite(s) are missing.`);
  console.error('See README.md and run the setup command for your platform.');
  process.exitCode = 1;
} else {
  console.log('\nThe local GridDB runtime is ready.');
}
