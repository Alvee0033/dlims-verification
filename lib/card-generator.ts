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
  website?: string | null;
  domain?: string | null;
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
let daemonProc: ChildProcess | null = null;
let daemonReady = false;
let daemonStarting = false;
let daemonQueue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];

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
        daemonReady = true;
        daemonStarting = false;
        return;
      }
      const waiter = daemonQueue.shift();
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
    daemonProc = null;
    daemonReady = false;
    daemonStarting = false;
    const pending = daemonQueue.splice(0);
    pending.forEach((w) => w.reject(new Error('Daemon exited')));
  });

  return proc;
}

function getDaemon(): Promise<ChildProcess | null> {
  return new Promise((resolve) => {
    if (daemonProc && daemonReady) {
      return resolve(daemonProc);
    }
    if (!daemonStarting) {
      daemonStarting = true;
      daemonProc = spawnDaemon();
    }
    const proc = daemonProc;
    const timeout = setTimeout(() => {
      resolve(null); // Timeout fallback to direct script
    }, 2500);

    const poll = setInterval(() => {
      if (daemonReady) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolve(proc);
      }
    }, 30);
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
    if (proc && daemonReady) {
      return await new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => {
          // If daemon hangs on this request, reject so fallback kicks in
          reject(new Error('Daemon request timeout'));
        }, 3000);

        daemonQueue.push({
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
