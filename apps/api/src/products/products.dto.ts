import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { OmitType } from '@nestjs/swagger';
export class CreateProductDto {
  @IsString() @IsNotEmpty() sku!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsOptional() @IsString() brand?: string;
  @Type(() => Number) @IsNumber() @Min(0) price!: number;
  @Type(() => Number) @IsInt() @Min(0) initialStock!: number;
  @Type(() => Number) @IsInt() @Min(1) weightGrams!: number;
  @Type(() => Number) @IsInt() @Min(1) lengthMm!: number;
  @Type(() => Number) @IsInt() @Min(1) widthMm!: number;
  @Type(() => Number) @IsInt() @Min(1) heightMm!: number;
  @IsOptional() @IsString() gtin?: string;
  @IsOptional() @IsString() ncm?: string;
}
export class UpdateProductDto extends OmitType(CreateProductDto, ['initialStock'] as const) {
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
export class StockAdjustmentDto {
  @IsEnum(['ENTRY', 'ADJUSTMENT', 'LOSS', 'RETURN'] as const) type!:
    'ENTRY' | 'ADJUSTMENT' | 'LOSS' | 'RETURN';
  @Type(() => Number) @IsInt() quantity!: number;
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsString() reference?: string;
}
