import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';

export interface CliProcess {
  process: ChildProcess;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: string;
  kill: () => Promise<void>;
  waitForOutput: (text: string, timeoutMs?: number) => Promise<boolean>;
}

/**
 * Spawns the CLI process and captures stdout/stderr.
 * @param args CLI arguments to pass
 * @param envOverrides Environment variables to override
 */
export function runCli(args: string[] = [], envOverrides: Record<string, string> = {}): CliProcess {
  const cliPath = resolve(__dirname, '../../dist/cli.js');
  const child = spawn('node', [cliPath, ...args], {
    env: { ...process.env, ...envOverrides },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuf = '';
  let stderrBuf = '';

  child.stdout?.on('data', (data: Buffer) => {
    stdoutBuf += data.toString();
  });

  child.stderr?.on('data', (data: Buffer) => {
    stderrBuf += data.toString();
  });

  const result: CliProcess = {
    process: child,
    get stdout() { return stdoutBuf; },
    get stderr() { return stderrBuf; },
    get output() { return stdoutBuf + stderrBuf; },
    kill: async () => {
      return new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
        child.kill('SIGTERM');
        // Force kill after 2 seconds if not exited
        setTimeout(() => {
          if (!child.killed && child.pid) {
            try {
              process.kill(child.pid, 'SIGKILL');
            } catch (err) {
              // Process already exited, ignore ESRCH error
            }
          }
          resolve();
        }, 2000);
      });
    },
    waitForOutput: async (text: string, timeoutMs: number = 5000): Promise<boolean> => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (stdoutBuf.includes(text) || stderrBuf.includes(text)) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (Date.now() - startTime > timeoutMs) {
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 100);
      });
    },
  };

  return result;
}
