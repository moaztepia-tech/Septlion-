import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class RevisionItemDto {
  @IsUUID() skuId!: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity!: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice!: number;
}

export class ReviseQuoteDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => RevisionItemDto) items!: RevisionItemDto[];
  @IsString() currency!: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() shippingTerms?: string;
  @IsOptional() @IsString() notes?: string;
}
