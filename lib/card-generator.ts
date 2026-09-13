import { spawn } from 'child_process';
import path from 'path';

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

export function generateCardBuffer(
  data: CardData,
  format: 'png' | 'pdf' = 'png'
): Promise<Buffer> {
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
        return reject(new Error(`Card generator failed (exit ${code}): ${stderr}`));
      }
      resolve(Buffer.concat(stdoutChunks));
    });

    py.stdin.write(JSON.stringify(data));
    py.stdin.end();
  });
}
