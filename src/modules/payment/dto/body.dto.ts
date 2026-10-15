import { TransactionStatus } from "@prisma/client";
import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from "class-validator";

export enum EarningSummaryType {
    YEARLY = "yearly",
    MONTHLY = "monthly",
    WEEKLY = "weekly",
}

export class EarningSummaryQueryDto {
    @IsEnum(EarningSummaryType)
    type: EarningSummaryType;
}

export class WithdrawQueryDto {
    @IsOptional()
    @IsEnum(TransactionStatus)
    status?: TransactionStatus;

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    limit?: string;
}

export class WithdrawRequestDto {
    @IsNumber()
    @Min(1)
    amount: number;
}
