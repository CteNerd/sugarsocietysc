const { spawn } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '..', '.env.local');
const result = dotenv.config({ path: envPath });
if (result.error && result.error.code !== 'ENOENT') {
  throw result.error;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  throw new Error('Provide a command to run after loading local environment variables');
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
child.on('error', (error) => {
  console.error(`Could not start ${command}`, error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
