import {
    IsArray,
    IsMongoId,
    IsOptional,
    IsString,  
    IsIn,
    IsNumber,
    Min,
    Max,
} from "class-validator";
import { OrderStatus } from "@prisma/client";
import { Type } from "class-transformer";

export class CreateOrderDto {
    @IsMongoId()
    shippingAddressId: string;

    @IsArray()
    cartIds: string[];

    @IsString()
    couponCode?: string;
}

export class OrderQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsIn(["Active", "Delivered", "Cancelled"])
    status?: OrderStatus;



    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    limit?: string;
}

export class DeliveryDto {
    @IsMongoId()
    deliveryId: string;

    @IsIn(["PickedUp", "Cancelled"])
    status: "PickedUp" | "Cancelled";
}
export class ConfirmDeliveryDto {
    @IsMongoId()
    deliveryId: string;

    @IsString()
    otp: string;
}

export class ApplyCouponDto {
    @IsString()
    code: string;
}

export class StartNavigationDto {
    @IsMongoId()
    deliveryId: string;

    @Type(() => Number)
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @Type(() => Number)
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;
}
