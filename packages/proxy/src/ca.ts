import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile, access, constants } from 'fs/promises';
import { generateCACertificate } from 'mockttp';
import chalk from 'chalk';

const CA_DIR = join(homedir(), '.claude-wiretap');
const CA_CERT_PATH = join(CA_DIR, 'ca.pem');
const CA_KEY_PATH = join(CA_DIR, 'ca-key.pem');

export interface CAConfig {
  certPath: string;
  keyPath: string;
  cert: string;
  key: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureCADirectory(): Promise<void> {
  try {
    await mkdir(CA_DIR, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function loadOrGenerateCA(): Promise<CAConfig> {
  await ensureCADirectory();

  const certExists = await fileExists(CA_CERT_PATH);
  const keyExists = await fileExists(CA_KEY_PATH);

  if (certExists && keyExists) {
    console.log(chalk.green('✓'), 'Using existing CA certificate from', chalk.cyan(CA_DIR));
    const cert = await readFile(CA_CERT_PATH, 'utf-8');
    const key = await readFile(CA_KEY_PATH, 'utf-8');
    return {
      certPath: CA_CERT_PATH,
      keyPath: CA_KEY_PATH,
      cert,
      key,
    };
  }

  console.log(chalk.yellow('⚙'), 'Generating new CA certificate...');

  const { cert, key } = await generateCACertificate({
    commonName: 'Claude Wiretap CA',
    organizationName: 'Claude Wiretap',
  });

  await writeFile(CA_CERT_PATH, cert);
  await writeFile(CA_KEY_PATH, key);

  console.log(chalk.green('✓'), 'CA certificate generated at', chalk.cyan(CA_DIR));
  console.log();
  console.log(chalk.yellow('To trust the CA certificate, run:'));
  console.log();
  console.log(chalk.gray('  # macOS:'));
  console.log(chalk.white(`  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CA_CERT_PATH}"`));
  console.log();
  console.log(chalk.gray('  # Linux (Debian/Ubuntu):'));
  console.log(chalk.white(`  sudo cp "${CA_CERT_PATH}" /usr/local/share/ca-certificates/claude-wiretap.crt`));
  console.log(chalk.white('  sudo update-ca-certificates'));
  console.log();
  console.log(chalk.gray('  # For Node.js/Claude Code, use:'));
  console.log(chalk.white(`  NODE_EXTRA_CA_CERTS="${CA_CERT_PATH}"`));
  console.log();

  return {
    certPath: CA_CERT_PATH,
    keyPath: CA_KEY_PATH,
    cert,
    key,
  };
}

export function getCAPath(): string {
  return CA_CERT_PATH;
}

export function getCADir(): string {
  return CA_DIR;
}
