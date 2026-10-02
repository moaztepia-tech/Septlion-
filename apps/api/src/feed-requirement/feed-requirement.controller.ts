import {Body,Controller,Post} from '@nestjs/common';
import {CreateFeedRequirementDto} from './feed-requirement.dto';
import {FeedRequirementService} from './feed-requirement.service';
@Controller('buyer-requirements')
export class FeedRequirementController{
 constructor(private service:FeedRequirementService){}
 @Post('feed') create(@Body() dto:CreateFeedRequirementDto){return this.service.create(dto)}
}