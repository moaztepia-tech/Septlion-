import {Body,Controller,Get,Post} from '@nestjs/common';
import {DemandIntelligenceService,DemandInput} from './demand-intelligence.service';

@Controller('demand-intelligence')
export class DemandIntelligenceController{
 constructor(private readonly service:DemandIntelligenceService){}
 @Get('signals') list(){return this.service.list()}
 @Post('signals') async ingest(@Body() body:DemandInput|DemandInput[]){
  const rows=Array.isArray(body)?body:[body];
  if(rows.length>100)return {accepted:0,error:'Maximum 100 signals per request'};
  const accepted=[];for(const row of rows){if(row?.source&&row?.sourceRecordId&&row?.market&&row?.product)accepted.push(await this.service.ingest(row))}
  return {received:rows.length,accepted:accepted.length,signals:accepted};
 }
}
