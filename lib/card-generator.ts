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
}

// ─── Persistent daemon singleton ─────────────────────────────────────────────
let daemonProc: ChildProcess | null = null;
let daemonReady = false;
let daemonQueue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];
let daemonLineBuffer = '';

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
        return;
      }
      // Deliver to next waiter in queue
      const waiter = daemonQueue.shift();
      if (waiter) {
        if (msg.ok) {
          waiter.resolve(trimmed);
        } else {
          waiter.reject(new Error(msg.error || 'Card daemon error'));
        }
      }
    } catch (e) {
      // Ignore unparseable lines (e.g. warnings)
    }
  });

  proc.stderr!.on('data', (chunk) => {
    process.stderr.write(`[card_daemon] ${chunk}`);
  });

  proc.on('exit', (code) => {
    console.error(`[card-generator] daemon exited with code ${code}, will respawn on next request`);
    daemonProc = null;
    daemonReady = false;
    // Reject all pending waiters
    const pending = daemonQueue.splice(0);
    pending.forEach((w) => w.reject(new Error('Card daemon crashed, please retry')));
  });

  return proc;
}

function getDaemon(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    if (daemonProc && daemonReady) {
      return resolve(daemonProc);
    }

    // Spawn new daemon
    daemonProc = spawnDaemon();
    const proc = daemonProc;

    // Wait up to 15 seconds for the daemon to signal ready
    const timeout = setTimeout(() => {
      reject(new Error('Card daemon startup timed out'));
    }, 15_000);

    const poll = setInterval(() => {
      if (daemonReady) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolve(proc);
      }
    }, 50);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateCardBuffer(
  data: CardData,
  format: 'png' | 'pdf' = 'png'
): Promise<Buffer> {
  const proc = await getDaemon();

  return new Promise((resolve, reject) => {
    daemonQueue.push({
      resolve: (line) => {
        try {
          const msg = JSON.parse(line);
          const buf = Buffer.from(msg.data, 'base64');
          resolve(buf);
        } catch (e) {
          reject(new Error('Failed to decode card daemon response'));
        }
      },
      reject,
    });

    const payload = JSON.stringify({ ...data, format }) + '\n';
    proc.stdin!.write(payload);
  });
}
