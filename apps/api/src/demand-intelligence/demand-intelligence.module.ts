import {Module} from '@nestjs/common';
import {DemandIntelligenceController} from './demand-intelligence.controller';
import {DemandIntelligenceService} from './demand-intelligence.service';
import {DemandCollectorScheduler} from './demand-collector.scheduler';
import {AgentWorker} from './agent-worker.service';

@Module({controllers:[DemandIntelligenceController],providers:[DemandIntelligenceService,DemandCollectorScheduler,AgentWorker],exports:[DemandIntelligenceService]})
export class DemandIntelligenceModule{}
