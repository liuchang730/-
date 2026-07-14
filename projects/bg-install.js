const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = __dirname;
const nodeDir = path.join(process.env.USERPROFILE, '.trae-cn', 'sdks', 'workspaces', '36585377', 'versions', 'node', 'current');
const pnpmCjs = path.join(nodeDir, 'bin', 'pnpm.cjs');
const nodeExe = path.join(nodeDir, 'node.exe');
const nmDir = path.join(projectDir, 'node_modules');
const logFile = path.join(projectDir, 'install-progress.log');

console.log('Starting pnpm install in background...');
console.log('Log file:', logFile);

const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const child = spawn(nodeExe, [pnpmCjs, 'install', '--prefer-offline', '--silent', '--no-strict-peer-dependencies'], {
  cwd: projectDir,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true
});

child.stdout.pipe(logStream);
child.stderr.pipe(logStream);

let lastCount = 0;
let noProgress = 0;

const checkInterval = setInterval(() => {
  try {
    if (fs.existsSync(nmDir)) {
      const entries = fs.readdirSync(nmDir);
      const count = entries.filter(e => e !== '.pnpm' && !e.includes('_tmp_')).length;
      const hasNext = fs.existsSync(path.join(nmDir, 'next'));
      const hasBin = fs.existsSync(path.join(nmDir, '.bin'));
      
      const line = `[${new Date().toLocaleTimeString()}] top=${count}, next=${hasNext}, bin=${hasBin}`;
      console.log(line);
      logStream.write(line + '\n');
      
      if (hasNext && hasBin && count > 100) {
        console.log('\n=== Installation looks complete! ===');
        clearInterval(checkInterval);
        logStream.end();
        process.exit(0);
      }
      
      if (count > lastCount) {
        lastCount = count;
        noProgress = 0;
      } else {
        noProgress++;
      }
      
      // If no progress for 20 iterations, exit and let user retry
      if (noProgress > 20) {
        console.log('\nNo progress detected. Exiting monitor.');
        clearInterval(checkInterval);
        logStream.end();
        process.exit(1);
      }
    }
  } catch(e) {
    // ignore
  }
}, 5000);

child.on('exit', (code) => {
  setTimeout(() => {
    const hasNext = fs.existsSync(path.join(nmDir, 'next'));
    const hasBin = fs.existsSync(path.join(nmDir, '.bin'));
    console.log(`\npnpm exit code: ${code}`);
    console.log(`next: ${hasNext}, bin: ${hasBin}`);
    logStream.end();
    clearInterval(checkInterval);
    process.exit(code);
  }, 1000);
});

child.unref();
