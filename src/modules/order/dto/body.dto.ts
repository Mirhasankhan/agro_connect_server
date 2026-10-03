import {
    IsArray,
    IsMongoId,
    IsOptional,
    IsString,
    IsEnum,
    IsIn,
} from "class-validator";
import { OrderStatus, PaymentStatus } from "@prisma/client";

export class CreateOrderDto {
    @IsMongoId()
    shippingAddressId: string;

    @IsArray()
    cartIds: string[];
}

export class OrderQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(OrderStatus)
    status?: OrderStatus;

    @IsOptional()
    @IsEnum(PaymentStatus)
    paymentStatus?: PaymentStatus;

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
