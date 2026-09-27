import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext { organizationId: string; userId: string; role: string; }

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();
  run<T>(ctx: TenantContext, fn: () => T) { return this.als.run(ctx, fn); }
  get(): TenantContext {
    const ctx = this.als.getStore();
    if (!ctx) throw new Error('Tenant context not initialized');
    return ctx;
  }
  get organizationId() { return this.get().organizationId; }
  get userId() { return this.get().userId; }
  get role() { return this.get().role; }
}
