import {  IsIn, IsOptional, IsString } from "class-validator";

export class PaymentQueryDto {
    @IsOptional()
    @IsIn(["true", "false"])
    isTransferred?: string;

    @IsOptional()
    @IsString()
    search?: string;
}
