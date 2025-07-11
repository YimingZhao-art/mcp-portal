const { spawn } = require('child_process');
const path = require('path');

// Start client dev server
console.log('Starting client dev server...');
const clientProcess = spawn('npm', ['run', 'dev', '--workspace=client'], {
  shell: true,
  stdio: 'pipe',
  env: { ...process.env }
});

clientProcess.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('➜  Local:')) {
    console.log('Client dev server started');
    
    // Start Electron after client is ready
    console.log('Starting Electron...');
    const electronProcess = spawn('electron', ['.'], {
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
    electronProcess.on('close', (code) => {
      console.log(`Electron exited with code ${code}`);
      clientProcess.kill();
      process.exit(code);
    });
  }
  console.log('[Client]', output.trim());
});

clientProcess.stderr.on('data', (data) => {
  console.error('[Client Error]', data.toString());
});

clientProcess.on('close', (code) => {
  console.log(`Client process exited with code ${code}`);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clientProcess.kill();
  process.exit();
});