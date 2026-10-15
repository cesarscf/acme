import { db } from '@acme/db';
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { phoneNumber } from 'better-auth/plugins';
import { ensureTemplate, sendMessage } from '../whatsapp/service';

const codeExpirationMinutes = 10;

// Authentication templates have fixed text; Meta writes the body from the code alone.
const loginCodeTemplate = {
  name: 'login_code',
  language: 'pt_BR',
  category: 'AUTHENTICATION',
  components: [
    { type: 'BODY', add_security_recommendation: true },
    { type: 'FOOTER', code_expiration_minutes: codeExpirationMinutes },
    { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copiar código' }] },
  ],
} as const;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),
  advanced: { database: { generateId: 'uuid' } },
  session: {
    // Login costs a WhatsApp message, so a session lasts long and renews while the app is used.
    expiresIn: 60 * 60 * 24 * 90,
  },
  trustedOrigins: ['acme://', ...(process.env.NODE_ENV === 'production' ? [] : ['exp://', 'exp://**'])],
  plugins: [
    expo(),
    phoneNumber({
      expiresIn: codeExpirationMinutes * 60,
      phoneNumberValidator: (phoneNumber) => /^55\d{10,11}$/.test(phoneNumber),
      sendOTP: ({ phoneNumber, code }) => sendLoginCode(phoneNumber, code),
      signUpOnVerification: { getTempEmail: (phoneNumber) => `${phoneNumber}@phone.acme.invalid` },
    }),
  ],
});

export function ensureLoginCodeTemplate() {
  return ensureTemplate(env('META_PLATFORM_WABA_ID'), loginCodeTemplate);
}

async function sendLoginCode(to: string, code: string) {
  await sendMessage({
    from: env('META_PLATFORM_PHONE_NUMBER_ID'),
    to,
    message: {
      type: 'template',
      template: {
        name: loginCodeTemplate.name,
        language: { code: loginCodeTemplate.language },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          // Meta sends the copy code button as a `url` button whose parameter is the code.
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    },
  });
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
