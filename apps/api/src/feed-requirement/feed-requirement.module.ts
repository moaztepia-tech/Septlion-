import {Module} from '@nestjs/common';
import {FeedRequirementController} from './feed-requirement.controller';
import {FeedRequirementService} from './feed-requirement.service';
@Module({controllers:[FeedRequirementController],providers:[FeedRequirementService]})
export class FeedRequirementModule{}
