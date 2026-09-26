import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenant: TenantContextService) {}
  use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const user = req.user;
    if (!user?.organizationId || !user?.sub || !user?.role) return next();
    this.tenant.run({ organizationId: user.organizationId, userId: user.sub, role: user.role }, next);
  }
}
