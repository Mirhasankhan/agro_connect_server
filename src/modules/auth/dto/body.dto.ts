import {
    IsEmail,
    IsString,
    IsIn,
    IsOptional,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsPhoneNumber,
} from "class-validator";
import { UserRole, ProducerType, DriverVehicleType } from "@prisma/client";

export class RegisterUserDto {
    @IsString()
    fullName: string;

    @IsEmail()
    email: string;

    @IsString()
    password: string;

    @IsIn([UserRole.BUYER, UserRole.DRIVER, UserRole.PRODUCER])
    role: UserRole;
}

export class VerifyRegistrationDto {
    @IsString()
    otp: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    fcmToken?: string;
}

export class updateUserDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsPhoneNumber()
    phoneNumber?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    region?: string;

    @IsOptional()
    @IsString()
    address?: string;
}

export class LoginUserDto {
    @IsEmail()
    email: string;

    @IsString()
    password: string;

    @IsOptional()
    @IsString()
    fcmToken?: string;
}

export class ResetPasswordDto {
    @IsString()
    password: string;
}

export class ChangePasswordDto {
    @IsString()
    oldPassword: string;

    @IsString()
    newPassword: string;
}

export class VerifyOtpDto {
    @IsString()
    otp: string;

    @IsEmail()
    email: string;
}

export class ResendOtpDto {
    @IsEmail()
    email: string;
}

export class SendForgotPasswordOtpDto {
    @IsEmail()
    email: string;
}

export class VerifyForgotPasswordOtpDto {
    @IsString()
    otp: string;

    @IsEmail()
    email: string;
}

export class RefreshTokenDto {
    @IsString()
    refreshToken: string;
}

export class CreateProducerProfileDto {
    @IsString()
    phoneNumber: string;

    @IsEnum(ProducerType)
    producerType: ProducerType;

    @IsString()
    city: string;

    @IsString()
    region: string;

    @IsString()
    address: string;

    @IsString()
    farmName: string;

    @IsNumber()
    farmSize: number;

    @IsString()
    farmLocation: string;

    @IsOptional()
    @IsString()
    companyName?: string;

    @IsOptional()
    @IsString()
    rccmNo?: string;

    @IsOptional()
    @IsString()
    sirenNo?: string;
}
export class CreateBuyerProfileDto {
    @IsString()
    phoneNumber: string;

    @IsString()
    city: string;

    @IsString()
    region: string;

    @IsString()
    address: string;

    @IsString()
    profileType: string;

    @IsString()
    institution: string;
}

export class CreateDriverProfileDto {
    @IsString()
    phoneNumber: string;

    @IsString()
    city: string;

    @IsString()
    region: string;

    @IsString()
    address: string;

    @IsEnum(DriverVehicleType)
    vehicleType: DriverVehicleType;

    @IsString()
    @IsNotEmpty()
    registrationNumber: string;
}
