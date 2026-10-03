import { PrismaService } from "@/core/services/prisma/prisma.service";
import { HttpStatus, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ApiError } from "@/common/errors/api_error";
import { BcryptService } from "@/common/utils/bcrypt.service";
import { generateOTP } from "./auth.utils";
import config from "@/config";
import { emailBody, resetPasswordEmail } from "./auth.template";
import {
    ChangePasswordDto,
    CreateDriverProfileDto,
    CreateProducerProfileDto,
    LoginUserDto,
    RefreshTokenDto,
    RegisterUserDto,
    ResendOtpDto,
    ResetPasswordDto,
    VerifyOtpDto,
    VerifyRegistrationDto,
} from "./dto/body.dto";
import { UserPayload } from "@/common/guards/auth.guard";
import { background } from "@/common/utils/background";
import sendEmail from "@/core/services/email";
import { FileService } from "@/core/services/files/cloudinary.service";

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private bcryptService: BcryptService,
        private prisma: PrismaService,
        private fileService: FileService,
    ) {}

    async register(payload: RegisterUserDto) {
        const userData = await this.prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true },
        });

        if (userData) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                "User with this Email already exists!",
            );
        }

        const { otp, otpExpiry } = generateOTP();

        const hashedPassword: string = await this.bcryptService.hash(
            payload.password,
            config.password.salt,
        );

        const hashedOtp: string = await this.bcryptService.hash(
            otp,
            config.password.salt,
        );

        await this.prisma.registrationVerification.upsert({
            where: {
                email: payload.email,
            },
            update: {
                otpHash: hashedOtp,
                expiresAt: new Date(otpExpiry),
                fullName: payload.fullName,
                phone: payload.phone,
                role: payload.role,
                password: hashedPassword,
            },
            create: {
                ...payload,
                password: hashedPassword,
                otpHash: hashedOtp,
                expiresAt: new Date(otpExpiry),
            },
        });

        const html = emailBody(payload.email, otp);
        await sendEmail(
            payload.email,
            `Your Account Verification OTP - ${config.company_name}`,
            html,
        );

        return {
            message: "Verification code sent to your email",
        };
    }

    async verifyRegistration(payload: VerifyRegistrationDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: payload.email },
        });

        if (existingUser) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                "User with this Email already exists!",
            );
        }

        const userData = await this.prisma.registrationVerification.findUnique({
            where: {
                email: payload.email,
            },
        });

        if (!userData) {
            throw new ApiError(HttpStatus.NOT_FOUND, "User not found");
        }

        const otpMatched = await this.bcryptService.compare(
            payload.otp,
            userData.otpHash,
        );

        if (!otpMatched) {
            throw new ApiError(HttpStatus.FORBIDDEN, "Incorrect OTP");
        }

        if (userData.expiresAt && userData.expiresAt < new Date()) {
            throw new ApiError(HttpStatus.BAD_REQUEST, "OTP expired");
        }

        const createdUser = await this.prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: {
                    email: userData.email,
                    password: userData.password,
                    fullName: userData.fullName,
                    phone: userData.phone,
                    role: userData.role,
                    fcmToken: payload.fcmToken,
                },
            });
            await tx.registrationVerification.delete({
                where: {
                    email: payload.email,
                },
            });
            return createdUser;
        });

        const jwtPayload = {
            id: createdUser.id,
            email: userData.email,
            role: userData.role,
        } satisfies UserPayload;

        const accessToken = this.jwtService.sign(jwtPayload, {
            secret: config.jwt.jwt_secret,
            expiresIn: config.jwt.jwt_secret_expires_in,
        });

        return {
            message: "Verified successfully! You can login now",
            data: {
                id: createdUser.id,
                role: createdUser.role,
                accessToken,
            },
        };
    }

    async loginWithEmail(payload: LoginUserDto) {
        const userData = await this.prisma.user.findUnique({
            where: {
                email: payload.email,
            },
        });

        if (!userData) {
            throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid Credentials");
        }

        const passwordMatched = await this.bcryptService.compare(
            payload.password,
            userData.password,
        );

        if (!passwordMatched) {
            throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid Credentials");
        }

        if (userData.status === "INACTIVE")
            throw new ApiError(
                HttpStatus.FORBIDDEN,
                "This account is Inactive",
            );
        if (userData.deleted)
            throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid Credentials");

        const jwtPayload = {
            id: userData.id,
            email: userData.email,
            role: userData.role,
        } satisfies UserPayload;

        const accessToken = this.jwtService.sign(jwtPayload, {
            secret: config.jwt.jwt_secret,
            expiresIn: config.jwt.jwt_secret_expires_in,
        });

        if (payload.fcmToken) {
            background.add(async () => {
                await this.prisma.user.update({
                    where: {
                        id: userData.id,
                    },
                    data: {
                        fcmToken: payload.fcmToken,
                    },
                });
            });
        }

        return {
            message: "Login successful",
            data: {
                accessToken,
                role: userData.role,
                isSetuCompleted: userData.isSetupCompleted,
            },
        };
    }

    async sendForgotPasswordOtp(payload: ResendOtpDto) {
        const userData = await this.prisma.user.findUnique({
            where: {
                email: payload.email,
            },
        });

        if (!userData) {
            throw new ApiError(404, "User not found");
        }

        const { otp, otpExpiry } = generateOTP();

        const hashedOtp: string = await this.bcryptService.hash(
            otp,
            config.password.salt,
        );

        await this.prisma.otp.upsert({
            where: {
                email: payload.email,
            },
            update: { otpHash: hashedOtp, expiresAt: new Date(otpExpiry) },
            create: {
                email: payload.email,
                otpHash: hashedOtp,
                expiresAt: new Date(otpExpiry),
            },
        });

        const html = resetPasswordEmail(userData.fullName, otp);
        await sendEmail(
            userData.email,
            `Password Reset OTP - ${config.company_name}`,
            html,
        );

        return {
            message: "OTP Sent Successfully!",
        };
    }

    async verifyOTP(payload: VerifyOtpDto) {
        const userData = await this.prisma.user.findUnique({
            where: {
                email: payload.email,
            },
            select: {
                id: true,
                email: true,
                role: true,
            },
        });

        if (!userData) {
            throw new ApiError(HttpStatus.NOT_FOUND, "User not found");
        }

        const otpData = await this.prisma.otp.findUnique({
            where: {
                email: payload.email,
            },
            select: {
                otpHash: true,
                expiresAt: true,
            },
        });

        const otpMatched = await this.bcryptService.compare(
            payload.otp,
            otpData.otpHash,
        );

        if (!otpMatched) {
            throw new ApiError(HttpStatus.FORBIDDEN, "Invalid OTP");
        }

        if (otpData.expiresAt < new Date()) {
            throw new ApiError(HttpStatus.BAD_REQUEST, "OTP expired");
        }

        const jwtPayload = {
            id: userData.id,
            email: userData.email,
            role: userData.role,
        } satisfies UserPayload;

        const accessToken = this.jwtService.sign(jwtPayload, {
            secret: config.jwt.jwt_secret,
            expiresIn: config.jwt.jwt_secret_expires_in,
        });

        await this.prisma.otp.delete({
            where: {
                email: payload.email,
            },
        });

        return {
            message: "OTP Verification successful",
            data: {
                accessToken,
            },
        };
    }

    async resetPassword(payload: ResetPasswordDto, user: UserPayload) {
        const userData = await this.prisma.user.findUnique({
            where: {
                email: user.email,
            },
        });

        if (!userData) {
            throw new ApiError(HttpStatus.NOT_FOUND, "User not found");
        }

        const password = await this.bcryptService.hash(
            payload.password,
            config.password.salt,
        );

        await this.prisma.user.update({
            where: {
                id: userData.id,
            },
            data: {
                password,
            },
        });
        return { message: "Password Reset successful" };
    }

    async refreshToken(payload: RefreshTokenDto) {
        if (!payload.refreshToken) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "refreshToken is required",
            );
        }

        let decrypted: UserPayload | undefined;
        try {
            decrypted = this.jwtService.verify(payload.refreshToken, {
                secret: config.jwt.refresh_token_secret,
            });
        } catch {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Refresh Token is Invalid or Expired",
            );
        }

        const userData = await this.prisma.user.findUnique({
            where: { id: decrypted.id },
        });

        if (!userData) {
            throw new ApiError(
                HttpStatus.UNAUTHORIZED,
                "Unauthenticated Request",
            );
        }

        const jwtPayload = {
            id: userData.id,
            role: userData.role,
            email: userData.email,
        };

        const accessToken = this.jwtService.sign(jwtPayload, {
            secret: config.jwt.jwt_secret,
            expiresIn: config.jwt.jwt_secret_expires_in,
        });

        return {
            data: { accessToken },
            message: "Access Token generated",
        };
    }

    async changePassword(payload: ChangePasswordDto, user: UserPayload) {
        const userData = await this.prisma.user.findUnique({
            where: { id: user.id },
        });

        if (!userData) {
            throw new ApiError(HttpStatus.NOT_FOUND, "User not found!");
        }

        if (!userData?.password) {
            throw new ApiError(
                HttpStatus.UNAUTHORIZED,
                "Unauthenticated Request!",
            );
        }

        const passwordValid = await this.bcryptService.compare(
            payload.oldPassword,
            userData?.password,
        );

        if (!passwordValid) {
            throw new ApiError(HttpStatus.UNAUTHORIZED, "Incorrect Password");
        }

        const hashedPassword = await this.bcryptService.hash(
            payload.newPassword,
            config.password.salt,
        );

        await this.prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                password: hashedPassword,
            },
        });
        return { message: "Password Changed successfully" };
    }

    async createProducerProfile(
        user: UserPayload,
        payload: CreateProducerProfileDto,
        file?: Express.Multer.File,
    ) {
        const existingProfile = await this.prisma.producerProfile.findUnique({
            where: {
                userId: user.id,
            },
            select: {
                id: true,
            },
        });

        if (existingProfile) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                "Producer profile already exists!",
            );
        }

        if (
            (payload.producerType === "Farm" && !payload.farmSize) ||
            !payload.farmName
        ) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Farm size and name are required for Farm type producer",
            );
        }

        if (payload.producerType === "Individual" && !payload.nidNumber) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "NID number is required for Individual type producer",
            );
        }

        let tradeLicenseUrl = null;

        if (file) {
            tradeLicenseUrl = await this.fileService.uploadToCloudinary(file);
        }

        if (
            (payload.producerType === "Business" && !tradeLicenseUrl) ||
            !payload.tinNumber
        ) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Trade license and TIN number are required for Business type producer",
            );
        }

        await this.prisma.producerProfile.create({
            data: {
                userId: user.id,
                tradeLicense: tradeLicenseUrl,
                ...payload,
            },
        });

        return {
            message: "Producer profile created successfully",
        };
    }

    async createDriverProfile(
        user: UserPayload,
        payload: CreateDriverProfileDto,
        file?: Express.Multer.File,
    ) {
        const existingProfile = await this.prisma.driverProfile.findUnique({
            where: {
                userId: user.id,
            },
            select: {
                id: true,
            },
        });

        if (existingProfile) {
            throw new ApiError(
                HttpStatus.CONFLICT,
                "Driver profile already exists!",
            );
        }

        let licenseUrl = null;

        if (file) {
            licenseUrl = await this.fileService.uploadToCloudinary(file);
        }

        if (!licenseUrl) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "License is required for Driver",
            );
        }

        await this.prisma.driverProfile.create({
            data: {
                userId: user.id,
                licenseUrl,
                ...payload,
            },
        });

        return {
            message: "Driver profile created successfully",
        };
    }
}
