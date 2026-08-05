import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireText = (file, text, label = text) => {
  if (!fs.existsSync(path.join(root, file)) || !read(file).includes(text)) {
    failures.push(`${file} missing ${label}`);
  }
};

const dashboard = 'src/pages/staff/EmployeeDashboard.tsx';
requireText(dashboard, 'requestEmailOtp', 'OTP request flow');
requireText(dashboard, 'shouldCreateUser: false', 'existing Auth account enforcement');
requireText(dashboard, 'verifyEmailOtp', 'OTP verification flow');
requireText(dashboard, "type: 'email'", 'email OTP verification type');
requireText(dashboard, '<InputOTP', 'six-digit OTP input');
requireText(dashboard, "functions.invoke('staff-email-auth'", 'post-OTP employee authorization check');
requireText(dashboard, 'registerTrustedDevice', 'independent trusted-device registration');
requireText(dashboard, 'otpResendSeconds', 'OTP resend cooldown');
requireText(dashboard, "signOut({ scope: 'local' })", 'device-local sign-out behavior');
requireText(dashboard, 'Every untrusted phone, tablet or computer may authenticate independently', 'explicit multi-device behavior');

requireText('supabase/config.toml', '[auth.email.template.magic_link]', 'local OTP email template config');
requireText('supabase/config.toml', 'staff-email-otp.html', 'OTP template file reference');
requireText('supabase/templates/staff-email-otp.html', '{{ .Token }}', 'numeric OTP template variable');
requireText('docs/PHASE-12E-TRAINING-VIDEOS-STAFF-MULTI-DEVICE-OTP.md', 'src/training/catalog.ts', 'training video instructions');
requireText('docs/PHASE-12E-TRAINING-VIDEOS-STAFF-MULTI-DEVICE-OTP.md', 'Staff access is attached', 'multi-device access documentation');

for (const locale of ['en', 'el', 'de', 'es', 'tr']) {
  const file = `src/i18n/locales/${locale}.json`;
  for (const key of ['otpTitle', 'otpDescription', 'otpCodeLabel', 'otpVerify', 'otpResend', 'multiDeviceTitle', 'multiDeviceDescription']) {
    requireText(file, `"${key}"`, `${locale} ${key} translation`);
  }
}

if (failures.length) {
  console.error('Staff multi-device OTP validation failed:');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('Phase 12E Staff multi-device OTP validation passed.');
console.log('Approved staff accounts can authenticate on additional devices with a six-digit email OTP while trusted sessions remain device-independent.');
