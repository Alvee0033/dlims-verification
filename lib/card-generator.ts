import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { createInterface } from 'readline';
import { getUploadedFile } from '@/lib/db';

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

// ─── Resolve Image (Disk / Database / Data URI) ──────────────────────────
async function resolveImageInput(inputUrl?: string | null): Promise<string | null> {
  if (!inputUrl || !inputUrl.trim()) return null;
  const str = inputUrl.trim();
  if (str.startsWith('data:image/')) return str;

  // Extract filename if it references /uploads/
  let filename = '';
  if (str.includes('/uploads/')) {
    filename = str.split('/uploads/')[1]?.split('?')[0]?.split('#')[0] || '';
  } else if (!str.startsWith('http://') && !str.startsWith('https://')) {
    filename = str.replace(/^\/?(public\/)?uploads\//, '').replace(/^\/+/, '');
  }

  if (filename) {
    const diskPath = path.join(process.cwd(), 'public', 'uploads', filename);
    // 1. Check if on disk
    try {
      await fs.access(diskPath);
      return diskPath;
    } catch {
      // Not on disk
    }

    // 2. Fetch from database uploaded_files table
    try {
      const dbFile = await getUploadedFile(filename);
      if (dbFile && dbFile.data) {
        try {
          await fs.mkdir(path.dirname(diskPath), { recursive: true });
          await fs.writeFile(diskPath, dbFile.data);
          return diskPath;
        } catch {
          // If write fails, return data URI directly
          const b64 = Buffer.isBuffer(dbFile.data)
            ? dbFile.data.toString('base64')
            : Buffer.from(dbFile.data).toString('base64');
          return `data:${dbFile.mime_type || 'image/jpeg'};base64,${b64}`;
        }
      }
    } catch (e) {
      console.warn('[card-generator] DB lookup error for upload:', filename, e);
    }
  }

  // 3. Fallback for external HTTP/HTTPS URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const res = await fetch(str, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        const buf = Buffer.from(arr);
        const ct = res.headers.get('content-type') || 'image/jpeg';
        return `data:${ct};base64,${buf.toString('base64')}`;
      }
    } catch (e) {
      console.warn('[card-generator] HTTP fetch failed for image:', str, e);
    }
  }

  return str;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateCardBuffer(
  data: CardData,
  format: 'png' | 'pdf' = 'png',
  preview: boolean = false
): Promise<Buffer> {
  const photoRaw = data.photoUrl || data.photo_url;
  const signatureRaw = data.signatureUrl || data.signature_url;

  const [resolvedPhoto, resolvedSignature] = await Promise.all([
    resolveImageInput(photoRaw),
    resolveImageInput(signatureRaw),
  ]);

  const resolvedData: CardData = {
    ...data,
    photoUrl: resolvedPhoto,
    photo_url: resolvedPhoto,
    signatureUrl: resolvedSignature,
    signature_url: resolvedSignature,
  };

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

        const payload = JSON.stringify({ ...resolvedData, format, preview }) + '\n';
        proc.stdin!.write(payload);
      });
    }
  } catch (err) {
    console.warn('[card-generator] Daemon failed, falling back to direct Python process:', err);
  }

  // Fallback to direct script execution
  return runDirectScript(resolvedData, format);
}
