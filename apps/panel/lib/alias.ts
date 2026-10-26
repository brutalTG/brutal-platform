import 'server-only';
import { createHash } from 'node:crypto';

// Mismo alias que ven los nodos (core.public_alias en la base).
export const publicAlias = (pseudonymId: string) => `NODO-${createHash('md5').update(pseudonymId).digest('hex').slice(0, 4).toUpperCase()}`;
