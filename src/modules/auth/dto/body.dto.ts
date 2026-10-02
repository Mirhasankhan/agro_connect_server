import {
    IsEmail,
    IsPhoneNumber,
    IsString,
    IsIn,
    IsOptional,
    IsArray,
    IsEnum,
} from "class-validator";
import { UserRole, ProducerType } from "@prisma/client";

export class RegisterUserDto {
    @IsString()
    fullName: string;

    @IsEmail()
    email: string;

    @IsPhoneNumber()
    phone: string;

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
