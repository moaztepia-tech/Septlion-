import {Body,Controller,Get,Header,Param,Post,Res} from '@nestjs/common';
import {Response} from 'express';
import {ClassifyMaritimeRfqDto,EstimateMaritimeRfqDto,SubmitMaritimeRfqDto} from './maritime-rfq.dto';
import {MaritimeRfqService} from './maritime-rfq.service';
@Controller('maritime-rfq')
export class MaritimeRfqController{
 constructor(private service:MaritimeRfqService){}
 @Post('classify')classify(@Body() dto:ClassifyMaritimeRfqDto){return this.service.classify(dto)}
 @Post('estimate')estimate(@Body() dto:EstimateMaritimeRfqDto){return this.service.estimate(dto)}
 @Post('submit')submit(@Body() dto:SubmitMaritimeRfqDto){return this.service.submit(dto)}
 @Get(':id')get(@Param('id')id:string){return this.service.get(id)}
 @Get(':id/pdf') @Header('Content-Type','application/pdf') async pdf(@Param('id')id:string,@Res()res:Response){const pdf=await this.service.pdf(id);res.setHeader('Content-Disposition',`attachment; filename="septlion-${id}.pdf"`);res.send(pdf)}
}
