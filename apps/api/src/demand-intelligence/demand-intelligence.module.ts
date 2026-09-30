import {Module} from '@nestjs/common';
import {DemandIntelligenceController} from './demand-intelligence.controller';
import {DemandIntelligenceService} from './demand-intelligence.service';
import {DemandCollectorScheduler} from './demand-collector.scheduler';

@Module({controllers:[DemandIntelligenceController],providers:[DemandIntelligenceService,DemandCollectorScheduler],exports:[DemandIntelligenceService]})
export class DemandIntelligenceModule{}
