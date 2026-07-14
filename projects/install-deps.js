const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = __dirname;
const nodeDir = path.join(process.env.USERPROFILE, '.trae-cn', 'sdks', 'workspaces', '36585377', 'versions', 'node', 'current');
const pnpmCjs = path.join(nodeDir, 'bin', 'pnpm.cjs');
const nodeExe = path.join(nodeDir, 'node.exe');

let attempts = 0;
const maxAttempts = 30;
const TIMEOUT = 240000;

function checkDone() {
  const nm = path.join(projectDir, 'node_modules');
  const next = path.join(nm, 'next');
  const bin = path.join(nm, '.bin');
  const topCount = fs.existsSync(nm) ? fs.readdirSync(nm).filter(d => d !== '.pnpm').length : 0;
  return {
    hasNext: fs.existsSync(next),
    hasBin: fs.existsSync(bin),
    topCount,
    nextBin: fs.existsSync(path.join(bin, 'next')),
    react: fs.existsSync(path.join(nm, 'react'))
  };
}

while (attempts < maxAttempts) {
  attempts++;
  const state = checkDone();
  console.log(`\n[${attempts}/${maxAttempts}] next=${state.hasNext} bin=${state.hasBin} react=${state.react} top=${state.topCount}`);
  
  if (state.hasNext && state.hasBin && state.react && state.topCount > 100) {
    console.log('\n=== Installation complete! ===');
    process.exit(0);
  }
  
  try {
    const result = spawnSync(nodeExe, [pnpmCjs, 'install', '--prefer-offline', '--silent'], {
      cwd: projectDir,
      stdio: 'ignore',
      timeout: TIMEOUT
    });
    if (result.status !== null) {
      console.log(`  pnpm exit: ${result.status}`);
    }
    if (result.error) console.log('  error:', result.error.message);
  } catch (e) {
    console.log('  exception:', e.message);
  }
}

const finalState = checkDone();
console.log(`\nFinal: next=${finalState.hasNext}, bin=${finalState.hasBin}, top=${finalState.topCount}`);
console.log(finalState.hasNext && finalState.hasBin ? 'Looks OK!' : 'May be incomplete');
