import {Module} from '@nestjs/common';import {MaritimeRfqController} from './maritime-rfq.controller';import {MaritimeRfqService} from './maritime-rfq.service';
@Module({controllers:[MaritimeRfqController],providers:[MaritimeRfqService]})export class MaritimeRfqModule{}
