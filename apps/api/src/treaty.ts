import { treaty } from '@elysiajs/eden';
import type { App } from './app';

export const api = treaty<App>(`http://localhost:${process.env.PORT ?? '4004'}`);
