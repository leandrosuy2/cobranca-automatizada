import { randomUUID } from 'crypto';

if (typeof global.crypto === 'undefined') {
  global.crypto = {
    randomUUID
  } as any;
} 