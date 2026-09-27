import {Type} from 'class-transformer';
import {IsDateString,IsEmail,IsIn,IsInt,IsNumber,IsOptional,IsString,MaxLength,Min} from 'class-validator';

export class ClassifyMaritimeRfqDto{
 @Type(()=>Number) @IsInt() @Min(1) containerCount!:number;
 @IsIn(['20FT','40FT','REEFER','OPEN_TOP','FLAT_RACK','BULK']) containerType!:string;
}
export class EstimateMaritimeRfqDto extends ClassifyMaritimeRfqDto{
 @IsString() @MaxLength(120) pol!:string;
 @IsString() @MaxLength(120) pod!:string;
 @IsOptional() @IsDateString() shipDate?:string;
}
export class SubmitMaritimeRfqDto extends EstimateMaritimeRfqDto{
 @IsString() @MaxLength(120) customerName!:string;
 @IsString() @MaxLength(160) company!:string;
 @IsEmail() email!:string;
 @IsString() @MaxLength(40) phone!:string;
 @IsIn(['FOB','CIF','EXW','DAP','FCA']) incoterm!:string;
 @IsIn(['GENERAL','DG','REEFER','OOG']) cargoType!:string;
 @IsDateString() declare shipDate:string;
 @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) grossWeight?:number;
 @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) cbm?:number;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) finalDestinations?:number;
 @IsOptional() @IsIn(['LC','TT','OPEN_ACCOUNT']) paymentTerm?:string;
 @IsOptional() @IsString() @MaxLength(2000) notes?:string;
 @IsString() @MaxLength(120) idempotencyKey!:string;
}
