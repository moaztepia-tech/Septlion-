import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'; import { JwtAuthGuard } from '../auth/jwt-auth.guard'; import { DocumentsService } from './documents.service';
@Controller('documents') @UseGuards(JwtAuthGuard) export class DocumentsController { constructor(private readonly service:DocumentsService){}
@Post('prepare') prepare(@Req() req:any,@Body() body:any){return this.service.prepare(req.user.organizationId,req.user.sub,body)}
@Post(':id/complete') complete(@Req() req:any,@Param('id') id:string,@Body() body:{sha256:string}){return this.service.complete(req.user.organizationId,id,body.sha256)}
@Get(':entityType/:entityId') list(@Req() req:any,@Param('entityType') entityType:any,@Param('entityId') entityId:string){return this.service.list(req.user.organizationId,entityType,entityId)} }
