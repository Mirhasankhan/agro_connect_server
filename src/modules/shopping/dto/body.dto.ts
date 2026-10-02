import { IsBoolean, IsInt, IsMongoId, IsNotEmpty, Min } from "class-validator";

export class CartDto {
    @IsMongoId()
    @IsNotEmpty()
    productId: string;

    @IsInt()
    @Min(1)
    quantity: number;
}

export class UpdateCartDto {
    @IsMongoId()
    cartId: string;

    @IsBoolean()
    increment: boolean;
}
