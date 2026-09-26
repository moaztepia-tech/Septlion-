import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/roles.decorator';
import { SupplierMatchingService } from './supplier-matching.service';

@Controller('supplier-matching')
@UseGuards(JwtAuthGuard)
export class SupplierMatchingController {
  constructor(private readonly service: SupplierMatchingService) {}

  @Get('rfq/:rfqId')
  @Roles(UserRole.BUYER, UserRole.ADMIN)
  match(@Param('rfqId') rfqId: string, @Query('limit') limit?: string) {
    return this.service.matchRfq(rfqId, Number(limit) || 20);
  }
}
