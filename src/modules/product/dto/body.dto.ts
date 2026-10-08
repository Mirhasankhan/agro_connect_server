import {
    IsArray,
    IsEnum,
    IsInt,
    IsMongoId,
    IsNotEmpty,
    IsString,
    Min,
    IsOptional,
    IsBoolean,
    IsIn,
} from "class-validator";
import { SellingUnit } from "@prisma/client";

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

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsInt()
    @Min(1)
    pricePerUnit: number;

    @IsInt()
    @Min(1)
    availableQuantity: number;
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
    @IsIn(["true", "false"])
    isActive?: string;

    @IsOptional()
    @IsString()
    minPrice?: string;

    @IsOptional()
    @IsString()
    maxPrice?: string;

    @IsOptional()
    @IsIn(["pricePerUnit", "availableQuantity", "avgRating", "createdAt"])
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
