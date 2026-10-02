import { IsString } from "class-validator";

export class ShippingAddressDto {
    @IsString()
    addressLine: string;

    @IsString()
    city: string;

    @IsString()
    postCode: string;

    @IsString()
    country: string;

    @IsString()
    instruction: string;
}

