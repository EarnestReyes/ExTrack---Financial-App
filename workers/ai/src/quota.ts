import { json, type QuotaState } from './types';

type Operation = 'supportChat' | 'explainInsights';
interface Usage {
  day: string; count: number; blocked: boolean;
  users: Record<string, { count: number; windows: Partial<Record<Operation, { minute: number; count: number }>> }>;
}

/** One namespace object shared by both endpoints. Every decision is durable/atomic. */
export class AIQuota {
  constructor(private state: QuotaState) {}
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const data = await request.json() as { action?: string; owner?: string; operation?: Operation; day?: string };
    if (data.action !== 'reserve' && data.action !== 'block') return json({ error: 'invalid' }, 400);
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const minute = Math.floor(now / 60000);
    if (data.action === 'reserve' && (!/^[a-f0-9]{64}$/.test(data.owner ?? '') || !['supportChat', 'explainInsights'].includes(data.operation ?? ''))) return json({ error: 'invalid' }, 400);
    return this.state.storage.transaction(async tx => {
      const stored = await tx.get<Usage>('usage');
      const usage: Usage = stored?.day === day ? stored : { day, count: 0, blocked: false, users: {} };
      if (data.action === 'block') {
        if (data.day === day) { usage.blocked = true; await tx.put('usage', usage); }
        return json({ ok: true });
      }
      if (!Number.isSafeInteger(usage.count) || usage.count < 0 || !usage.users) return json({ error: 'unavailable' }, 503);
      const owner = data.owner!;
      const operation = data.operation!;
      const user = usage.users[owner] ?? { count: 0, windows: {} };
      const window = user.windows[operation];
      const count = window?.minute === minute ? window.count : 0;
      const retryAfter = usage.blocked || usage.count >= 20 || user.count >= 5 ? Math.ceil((Date.parse(day + 'T00:00:00Z') + 86400000 - now) / 1000) : 60 - Math.floor(now / 1000) % 60;
      if (usage.blocked || usage.count >= 20 || user.count >= 5 || count >= 5) return json({ error: 'resource-exhausted', retryAfter }, 429);
      if (!Number.isSafeInteger(user.count) || user.count < 0 || !Number.isSafeInteger(count) || count < 0) return json({ error: 'unavailable' }, 503);
      user.count++; user.windows[operation] = { minute, count: count + 1 };
      usage.count++; usage.users[owner] = user;
      await tx.put('usage', usage);
      return json({ ok: true, day });
    });
  }
}
