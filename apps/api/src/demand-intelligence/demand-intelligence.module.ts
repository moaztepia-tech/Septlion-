import {Module} from '@nestjs/common';
import {DemandIntelligenceController} from './demand-intelligence.controller';
import {DemandIntelligenceService} from './demand-intelligence.service';

@Module({controllers:[DemandIntelligenceController],providers:[DemandIntelligenceService],exports:[DemandIntelligenceService]})
export class DemandIntelligenceModule{}
