import {Controller,Get,Param,Post,UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {Roles} from '../common/roles.decorator';
import {TradeCoreService} from './trade-core.service';
@Controller('trade') @UseGuards(JwtAuthGuard)
export class TradeCoreController{
 constructor(private readonly service:TradeCoreService){}
 @Post('commit/offer/:offerId') @Roles('BUYER','ADMIN') commitOffer(@Param('offerId') offerId:string){return this.service.commitAcceptedOffer(offerId)}
 @Post('commit/quote/:quoteId') @Roles('BUYER','ADMIN') commit(@Param('quoteId') quoteId:string){return this.service.commitAcceptedQuote(quoteId)}
 @Get('transactions/:id') @Roles('BUYER','SALES','ADMIN') get(@Param('id') id:string){return this.service.getTransaction(id)}
}
