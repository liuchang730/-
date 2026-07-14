const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = __dirname;
const nodeDir = path.join(process.env.USERPROFILE, '.trae-cn', 'sdks', 'workspaces', '36585377', 'versions', 'node', 'current');
const pnpmCjs = path.join(nodeDir, 'bin', 'pnpm.cjs');
const nodeExe = path.join(nodeDir, 'node.exe');
const nmDir = path.join(projectDir, 'node_modules');

function cleanup() {
  if (!fs.existsSync(nmDir)) return;
  let cleaned = 0;
  for (const entry of fs.readdirSync(nmDir)) {
    if (entry.includes('_tmp_')) {
      try {
        fs.rmSync(path.join(nmDir, entry), { recursive: true, force: true });
        cleaned++;
      } catch(e) {}
    }
  }
  if (cleaned > 0) console.log(`Cleaned ${cleaned} tmp dirs`);
}

function checkStatus() {
  if (!fs.existsSync(nmDir)) return { count: 0, next: false, bin: false, react: false };
  const entries = fs.readdirSync(nmDir);
  const count = entries.filter(e => e !== '.pnpm' && !e.includes('_tmp_')).length;
  return {
    count,
    next: fs.existsSync(path.join(nmDir, 'next')),
    bin: fs.existsSync(path.join(nmDir, '.bin')),
    react: fs.existsSync(path.join(nmDir, 'react'))
  };
}

cleanup();
let state = checkStatus();
console.log(`Status: top=${state.count}, next=${state.next}, bin=${state.bin}`);

for (let attempt = 1; attempt <= 15; attempt++) {
  if (state.next && state.bin && state.count > 100) {
    console.log(`\nSuccess after ${attempt - 1} attempts!`);
    process.exit(0);
  }
  
  console.log(`\n[Attempt ${attempt}/15] Installing...`);
  
  try {
    const result = spawnSync(nodeExe, [pnpmCjs, 'install', '--prefer-offline', '--silent'], {
      cwd: projectDir,
      stdio: 'ignore',
      timeout: 200000
    });
    
    cleanup();
    state = checkStatus();
    console.log(`  -> top=${state.count}, next=${state.next}, bin=${state.bin}`);
    
    if (result.status === 0 && state.next && state.bin) {
      console.log('\nInstallation successful!');
      process.exit(0);
    }
  } catch(e) {
    console.log('  error:', e.message);
  }
}

console.log('\n=== Final check ===');
state = checkStatus();
console.log(`top=${state.count}, next=${state.next}, bin=${state.bin}`);
console.log(state.next && state.bin ? 'Looks OK!' : 'May need more attempts');
