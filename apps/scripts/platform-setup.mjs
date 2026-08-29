const requestedPlatform = process.argv[2];
const platformNames = {
  linux: 'Linux',
  windows: 'Windows',
};

if (!(requestedPlatform in platformNames)) {
  console.error('Expected a platform argument: linux or windows');
  process.exit(2);
}

console.log(`${platformNames[requestedPlatform]} native setup is scaffolded but not automated yet.`);
console.log('Install Python 3.12, Java 21, Maven, and Git, then run npm run doctor.');
console.log('The licensed gridstore-advanced.jar must be downloaded from GridDB Cloud.');
console.log('The mock dashboard remains available with npm run dev.');
process.exitCode = 1;
