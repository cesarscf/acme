import { treaty } from '@elysia/eden';
import type { App } from '../../server/app';

export const { emulator } = treaty<App>(location.origin);
