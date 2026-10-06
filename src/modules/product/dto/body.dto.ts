import {
    IsArray,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsString,
    Min,
    IsOptional,
    ValidateNested,
    IsBoolean,
    IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { SellingUnit } from "@prisma/client";

export class PricingTierDto {
    @IsOptional()
    @IsMongoId()
    productId?: string;

    @IsInt()
    @Min(2)
    quantity: number;

    @IsInt()
    @Min(1)
    pricePerUnit: number;
}

export class ProductDto {
    @IsString()
    name: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsMongoId()
    categoryId: string;

    @IsEnum(SellingUnit)
    sellingUnit: SellingUnit;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @IsInt()
    @Min(1)
    pricePerUnit: number;

    @IsInt()
    @Min(1)
    availableQuantity: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PricingTierDto)
    pricingTiers: PricingTierDto[];
}

export class ProductQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsMongoId()
    categoryId?: string;

    @IsOptional()
    @IsEnum(SellingUnit)
    sellingUnit?: SellingUnit;

    @IsOptional()
    @IsIn(["active", "outOfStock"])
    status?: string;

    @IsOptional()
    @IsString()
    minPrice?: string;

    @IsOptional()
    @IsString()
    maxPrice?: string;

    @IsOptional()
    @IsIn(["pricePerUnit", "availableQuantity"])
    sort?: string;

    @IsOptional()
    @IsEnum(["asc", "desc"])
    order?: "asc" | "desc";

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    limit?: string;
}

export class UpdateProductDto {
    @IsMongoId()
    productId: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsMongoId()
    categoryId?: string;

    @IsOptional()
    @IsEnum(SellingUnit)
    sellingUnit?: SellingUnit;

    @IsOptional()
    @IsInt()
    @Min(1)
    pricePerUnit?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    availableQuantity?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;
}

export class UpdateProductImagesDto {
    @IsMongoId()
    productId: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    keptImages?: string[];
}
