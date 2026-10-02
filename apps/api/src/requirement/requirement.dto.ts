import {IsArray,IsDateString,IsIn,IsNumber,IsObject,IsOptional,IsString,MaxLength,Min} from 'class-validator';
export class CreateRequirementDto{
 @IsString() @MaxLength(500) product!:string;
 @IsString() @MaxLength(120) market!:string;
 @IsOptional() @IsNumber() @Min(0) quantity?:number;
 @IsOptional() @IsString() unit?:string;
 @IsOptional() @IsString() deliveryCountry?:string;
 @IsOptional() @IsString() deliveryPort?:string;
 @IsOptional() @IsIn(['CIF','CFR','FOB','DAP','DDP','EXW']) incoterm?:string;
 @IsOptional() @IsString() paymentPreference?:string;
 @IsOptional() @IsDateString() requiredDate?:string;
 @IsOptional() @IsObject() knownFacts?:Record<string,unknown>;
 @IsOptional() @IsObject() fieldStates?:Record<string,unknown>;
 @IsOptional() @IsArray() criticalMissing?:unknown[];
 @IsOptional() @IsObject() productConfiguration?:Record<string,unknown>;
 @IsOptional() @IsObject() specifications?:Record<string,unknown>;
 @IsOptional() @IsObject() packing?:Record<string,unknown>;
}
export class PatchRequirementDto{
 @IsOptional() @IsIn(['DRAFT','NEEDS_CLARIFICATION','QUALIFIED','SUPPLY_READY','ARCHIVED']) status?:string;
 @IsOptional() @IsObject() knownFacts?:Record<string,unknown>;
 @IsOptional() @IsObject() inferredFacts?:Record<string,unknown>;
 @IsOptional() @IsObject() fieldStates?:Record<string,unknown>;
 @IsOptional() @IsArray() criticalMissing?:unknown[];
 @IsOptional() @IsObject() productConfiguration?:Record<string,unknown>;
 @IsOptional() @IsObject() specifications?:Record<string,unknown>;
 @IsOptional() @IsObject() packing?:Record<string,unknown>;
 @IsOptional() @IsNumber() @Min(0) confidence?:number;
}
