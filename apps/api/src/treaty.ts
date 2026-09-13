import { treaty } from '@elysiajs/eden';
import { env } from '@together/config';
import type { App } from './app';

export const api = treaty<App>(`http://localhost:${env.PORT}`);
