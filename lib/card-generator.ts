import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { createInterface } from 'readline';

export interface CardData {
  name: string;
  urduName?: string | null;
  urdu_name?: string | null;
  fatherName?: string | null;
  father_name?: string | null;
  address: string;
  licenseNumber: string;
  license_number?: string;
  dob?: string | null;
  cnic: string;
  issueDate?: string | null;
  issue_date?: string | null;
  expiryDate?: string | null;
  expiry_date?: string | null;
  bloodGroup?: string | null;
  blood_group?: string | null;
  allowedVehicles?: string | null;
  allowed_vehicles?: string | null;
  photoUrl?: string | null;
  photo_url?: string | null;
  signatureUrl?: string | null;
  signature_url?: string | null;
  website?: string | null;
  domain?: string | null;
  barcodeText?: string | null;
  barcode_text?: string | null;
  preview?: boolean;
}

// ─── Direct Fallback (Guaranteed to work if daemon is ever busy/restarting) ───
function runDirectScript(data: CardData, format: 'png' | 'pdf' = 'png'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_card.py');
    const py = spawn('python3', [scriptPath, '--format', format]);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    py.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    py.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));

    py.on('error', (err) => reject(err));

    py.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        return reject(new Error(`Direct generator failed (exit ${code}): ${stderr}`));
      }
      resolve(Buffer.concat(stdoutChunks));
    });

    py.stdin.write(JSON.stringify(data));
    py.stdin.end();
  });
}

// ─── Persistent Daemon Singleton (Instant response) ──────────────────────────
interface DaemonState {
  proc: ChildProcess | null;
  ready: boolean;
  starting: boolean;
  queue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }>;
}

const g = globalThis as unknown as { __CARD_DAEMON_STATE__?: DaemonState };
if (!g.__CARD_DAEMON_STATE__) {
  g.__CARD_DAEMON_STATE__ = {
    proc: null,
    ready: false,
    starting: false,
    queue: [],
  };
}
const daemonState = g.__CARD_DAEMON_STATE__;

function spawnDaemon(): ChildProcess {
  const scriptPath = path.join(process.cwd(), 'scripts', 'card_daemon.py');
  const proc = spawn('python3', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });

  const rl = createInterface({ input: proc.stdout! });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.ready) {
        daemonState.ready = true;
        daemonState.starting = false;
        return;
      }
      const waiter = daemonState.queue.shift();
      if (waiter) {
        if (msg.ok) {
          waiter.resolve(trimmed);
        } else {
          waiter.reject(new Error(msg.error || 'Card daemon error'));
        }
      }
    } catch {
      // Ignore non-json lines
    }
  });

  proc.stderr!.on('data', (chunk) => {
    process.stderr.write(`[card_daemon] ${chunk}`);
  });

  proc.on('exit', () => {
    daemonState.proc = null;
    daemonState.ready = false;
    daemonState.starting = false;
    const pending = daemonState.queue.splice(0);
    pending.forEach((w) => w.reject(new Error('Daemon exited')));
  });

  return proc;
}

// Eagerly boot daemon on process startup so it is hot and instant for all incoming requests
if (!daemonState.proc && !daemonState.starting) {
  daemonState.starting = true;
  daemonState.proc = spawnDaemon();
}

function getDaemon(): Promise<ChildProcess | null> {
  return new Promise((resolve) => {
    if (daemonState.proc && daemonState.ready) {
      return resolve(daemonState.proc);
    }
    if (!daemonState.starting) {
      daemonState.starting = true;
      daemonState.proc = spawnDaemon();
    }
    const proc = daemonState.proc;
    const timeout = setTimeout(() => {
      resolve(null); // Timeout fallback to direct script
    }, 8000);

    const poll = setInterval(() => {
      if (daemonState.ready) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolve(proc);
      }
    }, 20);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateCardBuffer(
  data: CardData,
  format: 'png' | 'pdf' = 'png',
  preview: boolean = false
): Promise<Buffer> {
  try {
    const proc = await getDaemon();
    if (proc && daemonState.ready) {
      return await new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Daemon request timeout'));
        }, 8000);

        daemonState.queue.push({
          resolve: (line) => {
            clearTimeout(timeout);
            try {
              const msg = JSON.parse(line);
              const buf = Buffer.from(msg.data, 'base64');
              resolve(buf);
            } catch (e) {
              reject(new Error('Failed to decode card daemon response'));
            }
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        });

        const payload = JSON.stringify({ ...data, format, preview }) + '\n';
        proc.stdin!.write(payload);
      });
    }
  } catch (err) {
    console.warn('[card-generator] Daemon failed, falling back to direct Python process:', err);
  }

  // Fallback to direct script execution
  return runDirectScript(data, format);
}
