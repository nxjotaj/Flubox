import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
export class OrderItemDto { @IsString() productId!: string; @IsInt() @Min(1) quantity!: number; }
export class CreateOrderDto { @IsString() @IsNotEmpty() recipientName!: string; @IsOptional() @IsString() recipientTaxId?: string; @IsObject() recipientAddress!: Record<string, unknown>; @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[]; }
export class ManualPaymentDto { @IsIn(['CONFIRMED','REJECTED','REVIEW']) status!: 'CONFIRMED'|'REJECTED'|'REVIEW'; @IsString() @IsNotEmpty() reason!: string; }
export class ShipOrderDto { @IsOptional() @IsString() trackingCode?: string; @IsOptional() @IsString() notes?: string; }
