import {
    IsEmail,
    IsString,
    IsIn,
    IsOptional,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsDateString,
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
    phone?: string;
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
    @IsOptional()
    @IsString()
    farmName?: string;

    @IsEnum(ProducerType)
    producerType: ProducerType;

    @IsOptional()
    @IsString()
    farmSize?: string;

    @IsString()
    address: string;

    @IsString()
    district: string;
    @IsString()
    region: string;

    @IsArray()
    @IsString({ each: true })
    productionTypes: string[];

    @IsOptional()
    @IsString()
    nidNumber?: string;

    @IsOptional()
    @IsString()
    tinNumber?: string;
}

export class CreateDriverProfileDto {
    @IsString()
    @IsNotEmpty()
    nidNumber: string;

    @IsDateString()
    dateOfBirth: string;

    @IsString()
    @IsNotEmpty()
    drivingLicenseNumber: string;

    @IsEnum(DriverVehicleType)
    vehicleType: DriverVehicleType;

    @IsString()
    @IsNotEmpty()
    vehicleRegistration: string;

    @IsString()
    @IsNotEmpty()
    vehicleModel: string;

    @IsString()
    @IsNotEmpty()
    vehicleColor: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsString()
    @IsNotEmpty()
    district: string;
}
