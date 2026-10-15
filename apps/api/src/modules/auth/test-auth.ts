import { randomInt } from 'node:crypto';
import { db } from '@acme/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { testUtils } from 'better-auth/plugins';

// Test-only instance over the same database and secret, so its sessions are valid for the app.
const testAuth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),
  advanced: { database: { generateId: 'uuid' } },
  plugins: [testUtils()],
});

export async function signInNewProfessional() {
  const { test } = await testAuth.$context;
  const phoneNumber = `55119${String(randomInt(1e8)).padStart(8, '0')}`;
  const professional = await test.saveUser(
    test.createUser({ name: phoneNumber, email: `${phoneNumber}@phone.acme.invalid`, phoneNumber }),
  );
  const { headers } = await test.login({ userId: professional.id });
  return { professional, headers: { cookie: headers.get('cookie')! } };
}
