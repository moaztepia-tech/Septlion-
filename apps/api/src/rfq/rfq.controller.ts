import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RFQStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { Roles } from '../common/roles.decorator'; import { RfqService } from './rfq.service'; import { CreateRfqDto } from './dto/create-rfq.dto';
@Controller('rfq') @UseGuards(JwtAuthGuard)
export class RfqController{constructor(private service:RfqService){} @Post() @Roles(UserRole.BUYER,UserRole.ADMIN) create(@Body() dto:CreateRfqDto){return this.service.create(dto);} @Get('mine') mine(){return this.service.mine();} @Get(':id') get(@Param('id') id:string){return this.service.get(id);} @Patch(':id/status/:status') transition(@Param('id') id:string,@Param('status') status:RFQStatus){return this.service.transition(id,status);}}
