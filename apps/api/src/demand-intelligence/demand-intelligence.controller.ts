import {Body,Controller,Get,Param,Post,UseGuards} from '@nestjs/common';
import {UserRole} from '@prisma/client';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {Roles} from '../common/roles.decorator';
import {DemandIntelligenceService,DemandInput} from './demand-intelligence.service';

@Controller('demand-intelligence')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN,UserRole.SALES)
export class DemandIntelligenceController{
 constructor(private readonly service:DemandIntelligenceService){}
 @Get('command-center') commandCenter(){return this.service.commandCenter()}
 @Get('approvals') approvals(){return this.service.approvals()}
 @Post('approvals/:id/approve') @Roles(UserRole.ADMIN) approve(@Param('id') id:string,@Body() body:{decidedBy?:string}){return this.service.decideApproval(id,'APPROVED',body.decidedBy)}
 @Post('approvals/:id/reject') @Roles(UserRole.ADMIN) reject(@Param('id') id:string,@Body() body:{decidedBy?:string}){return this.service.decideApproval(id,'REJECTED',body.decidedBy)}
 @Post('opportunities/:id/approval') requestApproval(@Param('id') id:string,@Body() body:{action:any;title:string;summary?:string;payload?:unknown}){return this.service.requestApproval(id,body)}
 @Post('opportunities/:id/supply-candidates') addSupply(@Param('id') id:string,@Body() body:any){return this.service.addSupplyCandidate(id,body)}
 @Post('opportunities/:id/deal-drafts') createDeal(@Param('id') id:string,@Body() body:any){return this.service.createDealDraft(id,body)}
 @Get('signals') list(){return this.service.list()}
 @Get('opportunities') opportunities(){return this.service.opportunities()}
 @Get('opportunities/:id') opportunity(@Param('id') id:string){return this.service.opportunity(id)}
 @Post('opportunities/:id/orchestrate') orchestrate(@Param('id') id:string){return this.service.orchestrate(id)}
 @Post('opportunities/:id/agents') queueAgent(@Param('id') id:string,@Body() body:{agentType:string;input?:unknown;runtime?:string}){return this.service.queueAgent(id,body.agentType,body.input??{},body.runtime)}
 @Post('signals') async ingest(@Body() body:DemandInput|DemandInput[]){
  const rows=Array.isArray(body)?body:[body];if(rows.length>100)return {accepted:0,error:'Maximum 100 signals per request'};
  const accepted=[];for(const row of rows){if(row?.source&&row?.sourceRecordId&&row?.market&&row?.product)accepted.push(await this.service.ingest(row))}
  return {received:rows.length,accepted:accepted.length,signals:accepted};
 }
}
