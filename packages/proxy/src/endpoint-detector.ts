import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Endpoint detection configuration
 * Reads Claude Code configuration to determine which endpoint to use
 */

/**
 * Endpoint information returned by detectEndpoint()
 */
export interface EndpointInfo {
  url: string;
  source: 'env_var' | 'claude_settings' | 'default';
  isLocalLlm: boolean;
}

/**
 * Reads ANTHROPIC_BASE_URL environment variable
 * @returns The URL if set, null otherwise
 */
export function readEnvVar(): string | null {
  const url = process.env.ANTHROPIC_BASE_URL;
  if (url && url.trim() !== '') {
    return url.trim();
  }
  return null;
}

/**
 * Reads ~/.claude/settings.json and extracts ANTHROPIC_BASE_URL field
 * @returns The URL if found, null otherwise
 */
export function readClaudeSettings(): string | null {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    if (!existsSync(settingsPath)) {
      return null;
    }

    const content = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    if (settings.env && settings.env.ANTHROPIC_BASE_URL) {
      const url = String(settings.env.ANTHROPIC_BASE_URL);
      if (url && url.trim() !== '') {
        return url.trim();
      }
    }
  } catch (error) {
    // If settings.json is malformed or unreadable, return null
    console.debug('Failed to read or parse Claude settings:', error);
  }

  return null;
}

/**
 * Determines the endpoint URL based on configuration sources
 * Priority:
 * 1. ANTHROPIC_BASE_URL environment variable
 * 2. ~/.claude/settings.json _ANTHROPIC_BASE_URL field
 * 3. Default to https://api.anthropic.com/v1/messages
 *
 * @returns EndpointInfo with URL, source, and isLocalLlm flag
 */
export function determineEndpoint(): EndpointInfo {
  // Check environment variable first
  const envUrl = readEnvVar();
  if (envUrl) {
    return {
      url: envUrl,
      source: 'env_var',
      isLocalLlm: isLocalLlmUrl(envUrl),
    };
  }

  // Check Claude settings file
  const settingsUrl = readClaudeSettings();
  if (settingsUrl) {
    return {
      url: settingsUrl,
      source: 'claude_settings',
      isLocalLlm: isLocalLlmUrl(settingsUrl),
    };
  }

  // Default to Claude API
  return {
    url: 'https://api.anthropic.com/v1/messages',
    source: 'default',
    isLocalLlm: false,
  };
}

/**
 * Alias for determineEndpoint() for compatibility
 * @returns EndpointInfo
 */
export function detectEndpoint(): EndpointInfo {
  return determineEndpoint();
}

/**
 * Evaluates whether a URL points to the local machine or an address within a local network.
 * @param url The URL to check
 * @returns true if the URL belongs to localhost or a local network, false otherwise
 */
function isLocalLlmUrl(url: string): boolean {
  try {
    // Add "http://" if no protocol is specified to prevent the URL parser from failing
    const urlString = url.startsWith('http') ? url : `http://${url}`;
    const parsed = new URL(urlString);
    const hostname = parsed.hostname;

    // 1. Check the local machine itself (localhost and loopback addresses)
    if (hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.')) {
      return true;
    }

    // 2. Check common local and corporate domain endings
    // .local (mDNS), .lan, .corp, .internal, .home, .test (RFC 2606)
    if (
        hostname.endsWith('.local') ||
        hostname.endsWith('.lan') ||
        hostname.endsWith('.corp') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.home') ||
        hostname.endsWith('.test')
    ) {
      return true;
    }

    // 3. Check private local network IP addresses (according to RFC 1918 standard)

    // 10.x.x.x subnet
    if (hostname.startsWith('10.')) {
      return true;
    }

    // 192.168.x.x subnet
    if (hostname.startsWith('192.168.')) {
      return true;
    }

    // Subnet from 172.16.x.x to 172.31.x.x
    if (hostname.startsWith('172.')) {
      const parts = hostname.split('.');
      const secondOctet = parseInt(parts[1], 10);
      // Check that the second number in the IP address is between 16 and 31
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    // If no conditions are met, it is considered an external address
    return false;
  } catch {
    // If the URL is so malformed that the parser fails, assume it's external
    return false;
  }
}