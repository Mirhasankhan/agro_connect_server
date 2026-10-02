import { IsArray, IsMongoId } from "class-validator";

export class CreateOrderDto {

    @IsMongoId()
    shippingAddressId: string;

    @IsArray()
    cartIds: string[];
}