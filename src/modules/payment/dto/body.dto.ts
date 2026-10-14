import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";

export enum EarningSummaryType {
    YEARLY = "yearly",
    MONTHLY = "monthly",
    WEEKLY = "weekly",
}

export class EarningSummaryQueryDto {
    @IsEnum(EarningSummaryType)
    type: EarningSummaryType;
}

export class PaymentQueryDto {
    @IsOptional()
    @IsIn(["true", "false"])
    isTransferred?: string;

    @IsOptional()
    @IsString()
    search?: string;
}
