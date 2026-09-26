import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantContextService) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.organizationId) return next.handle();
    return new Observable(subscriber => {
      this.tenant.run({ organizationId: user.organizationId, userId: user.sub, role: user.role }, () => {
        next.handle().subscribe({ next: v => subscriber.next(v), error: e => subscriber.error(e), complete: () => subscriber.complete() });
      });
    });
  }
}
