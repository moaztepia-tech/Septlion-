import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}
  @UseGuards(JwtAuthGuard) @Get('public') publicList(@Query('sectorId') sectorId?: string) { return this.service.listPublic(sectorId); }
  @UseGuards(JwtAuthGuard) @Get('public/sku/:id') publicSku(@Param('id') id: string) { return this.service.publicSku(id); }
  @UseGuards(JwtAuthGuard) @Get('me/sku/:id') ownSku(@Param('id') id: string) { return this.service.ownSku(id); }
}
