import {
    DriverVehicleType,
    ProducerType,
    VerificationStatus,
} from "@prisma/client";
import {
    IsBoolean,
    IsOptional,
    IsString,
    IsMongoId,
    IsEnum,
} from "class-validator";

export class AcceptRejectAccountDto {
    @IsMongoId()
    accountId: string;

    @IsBoolean()
    isAccept: boolean;

    @IsOptional()
    @IsString()
    rejectReason?: string;
}

export class CategoryDto {
    @IsString()
    name: string;

    @IsString()
    slug: string;

    @IsString()
    description: string;
}

export class BaseUserQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(["asc", "desc"])
    order?: "asc" | "desc";

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsEnum(VerificationStatus)
    verificationStatus?: VerificationStatus;

    @IsOptional()
    @IsString()
    limit?: string;
}

export class ProducerQueryDto extends BaseUserQueryDto {
    @IsOptional()
    @IsEnum(ProducerType)
    producerType?: ProducerType;
}

export class DriverQueryDto extends BaseUserQueryDto {
    @IsOptional()
    @IsEnum(DriverVehicleType)
    vehicleType?: DriverVehicleType;
}

export class AssignDriverDto {
    @IsMongoId()
    orderId: string;

    @IsMongoId()
    driverId: string;
}
