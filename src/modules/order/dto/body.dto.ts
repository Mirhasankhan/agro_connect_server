import {
    IsArray,
    IsMongoId,
    IsOptional,
    IsString,
    IsEnum,
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
