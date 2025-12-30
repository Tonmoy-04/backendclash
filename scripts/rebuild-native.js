const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function readElectronVersion() {
  const pkgPath = path.join(__dirname, '..', 'node_modules', 'electron', 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

function run() {
  const electronVersion = readElectronVersion();
  if (!electronVersion) {
    console.error('[rebuild-native] Could not read Electron version from node_modules/electron. Run `npm install` at repo root first.');
    process.exit(1);
  }

  // sqlite3 ships N-API prebuilds and its install script forces `prebuild-install -r napi`.
  // That means `npm_config_target` must be the N-API version, NOT the Electron version.
  // We derive it from the current Node toolchain.
  const napiTarget = Number(process.versions.napi);
  if (!Number.isFinite(napiTarget)) {
    console.error('[rebuild-native] Could not determine N-API version from process.versions.napi');
    process.exit(1);
  }

  const args = [
    'rebuild',
    'sqlite3',
    '--prefix',
    'server',
    '--runtime=napi',
    `--target=${napiTarget}`
  ];

  console.log(`[rebuild-native] Rebuilding sqlite3 (N-API v${napiTarget}) for Electron ${electronVersion} (server/)...`);

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npmCmd, args, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (res.status !== 0) {
    console.error(`[rebuild-native] Failed with exit code ${res.status}`);
    process.exit(res.status || 1);
  }

  console.log('[rebuild-native] Done.');
}

run();
