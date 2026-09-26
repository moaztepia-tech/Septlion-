import { Module } from '@nestjs/common';
import { SupplierMatchingController } from './supplier-matching.controller';
import { SupplierMatchingService } from './supplier-matching.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({ imports: [PrismaModule], controllers: [SupplierMatchingController], providers: [SupplierMatchingService], exports: [SupplierMatchingService] })
export class SupplierMatchingModule {}
