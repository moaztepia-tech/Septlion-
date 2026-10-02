import {IsEmail,IsIn,IsInt,IsNotEmpty,IsOptional,IsString,Max,Min,ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';

class FeedBuyerDto{
 @IsString() @IsNotEmpty() name!:string;
 @IsString() @IsNotEmpty() company!:string;
 @IsString() @IsNotEmpty() whatsapp!:string;
 @IsOptional() @IsEmail() email?:string;
}
class FeedDestinationDto{
 @IsString() @IsNotEmpty() port!:string;
 @IsString() @IsNotEmpty() country!:string;
 @IsOptional() @IsString() code?:string;
}
class FeedProductDto{
 @IsString() @IsNotEmpty() id!:string;
 @IsString() @IsNotEmpty() name!:string;
 @IsString() @IsNotEmpty() nameEn!:string;
 @IsString() @IsNotEmpty() packing!:string;
}
export class CreateFeedRequirementDto{
 @ValidateNested() @Type(()=>FeedProductDto) product!:FeedProductDto;
 @IsInt() @Min(1) @Max(100000) containerCount!:number;
 @IsString() @IsNotEmpty() septlionScale!:string;
 @IsIn(['CIF','CFR','FOB']) incoterm!:'CIF'|'CFR'|'FOB';
 @ValidateNested() @Type(()=>FeedDestinationDto) destination!:FeedDestinationDto;
 @IsIn(['L/C','T/T','OTHER']) paymentPreference!:'L/C'|'T/T'|'OTHER';
 @ValidateNested() @Type(()=>FeedBuyerDto) buyer!:FeedBuyerDto;
 @IsOptional() sourceContext?:Record<string,unknown>;
}