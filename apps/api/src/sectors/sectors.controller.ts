import { Controller, Get, Param } from '@nestjs/common';
import { SectorsService } from './sectors.service';
@Controller('sectors')
export class SectorsController { constructor(private readonly service: SectorsService) {} @Get() list() { return this.service.list(); } @Get(':code') get(@Param('code') code: string) { return this.service.get(code); } }
