import { staffSupabase } from '@/db/staffSupabase';

type TrustedDeviceCredentials = {
  deviceId: string;
  deviceSecret: string;
};

function storageKey(employeeId: string) {
  return `velliqo.staff.device.${employeeId}`;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function randomToken(bytes: number) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getTrustedDeviceCredentials(employeeId: string): TrustedDeviceCredentials | null {
  try {
    const raw = localStorage.getItem(storageKey(employeeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrustedDeviceCredentials;
    if (!parsed?.deviceId || !parsed?.deviceSecret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getOrCreateTrustedDeviceCredentials(employeeId: string) {
  const existing = getTrustedDeviceCredentials(employeeId);
  if (existing) return existing;
  const credentials = {
    deviceId: `dev_${randomToken(18)}`,
    deviceSecret: randomToken(32),
  };
  localStorage.setItem(storageKey(employeeId), JSON.stringify(credentials));
  return credentials;
}

export function clearTrustedDeviceCredentials(employeeId: string) {
  localStorage.removeItem(storageKey(employeeId));
}

export async function registerTrustedDevice(input: {
  businessSlug: string;
  employeeId: string;
  employeeName?: string | null;
}) {
  const credentials = getOrCreateTrustedDeviceCredentials(input.employeeId);
  const tokenHash = await sha256(credentials.deviceSecret);
  const { error } = await staffSupabase.rpc('staff_register_trusted_device', {
    p_business_slug: input.businessSlug,
    p_device_id: credentials.deviceId,
    p_token_hash: tokenHash,
    p_device_label: deviceLabel(input.employeeName),
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
  return credentials;
}

export async function trustedDeviceSignIn(input: {
  businessSlug: string;
  employeeId: string;
  email: string;
}) {
  const credentials = getTrustedDeviceCredentials(input.employeeId);
  if (!credentials) {
    throw new Error('TRUSTED_DEVICE_REQUIRED');
  }

  const { data, error } = await staffSupabase.functions.invoke('staff-device-auth', {
    body: {
      business_slug: input.businessSlug,
      employee_id: input.employeeId,
      email: input.email.trim().toLowerCase(),
      device_id: credentials.deviceId,
      device_secret: credentials.deviceSecret,
      origin: window.location.origin,
    },
  });

  if (error) throw error;
  if (!data?.token_hash) throw new Error(data?.error || 'TRUSTED_DEVICE_SIGN_IN_FAILED');

  const { error: verifyError } = await staffSupabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: 'magiclink',
  });
  if (verifyError) throw verifyError;
  return true;
}

export async function revokeTrustedDevice(input: { businessSlug: string; employeeId: string }) {
  const credentials = getTrustedDeviceCredentials(input.employeeId);
  if (credentials) {
    const { error } = await staffSupabase.rpc('staff_revoke_trusted_device', {
      p_business_slug: input.businessSlug,
      p_device_id: credentials.deviceId,
    });
    if (error) throw error;
  }
  clearTrustedDeviceCredentials(input.employeeId);
}

function deviceLabel(employeeName?: string | null) {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || 'Device';
  const name = employeeName?.trim();
  return name ? `${name} · ${platform}` : platform;
}
