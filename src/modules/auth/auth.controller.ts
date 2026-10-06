import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Put,
    Req,
    UploadedFile,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsPublic } from "@/common/decorators/auth.decorator";
import { Request } from "express";
import { ResponseService } from "@/common/interceptors/response";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
    ChangePasswordDto,
    CreateDriverProfileDto,
    CreateProducerProfileDto,
    LoginUserDto,
    RefreshTokenDto,
    RegisterUserDto,
    ResetPasswordDto,
    SendForgotPasswordOtpDto,
    updateUserDto,
    VerifyForgotPasswordOtpDto,
    VerifyRegistrationDto,
} from "./dto/body.dto";
import { UserPayload } from "@/common/guards/auth.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import {
    CustomFileFieldsInterceptor,
    CustomFileInterceptor,
} from "@/common/interceptors/file_interceptors";
import { ParseFormDataInterceptor } from "@/common/interceptors/form_data_interceptor";
import { UserRole } from "@prisma/client";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
    constructor(private authService: AuthService) {}
  
    @IsPublic()
    @Post("register")
    @ApiOperation({ summary: "Register User" })
    async register(@Body() payload: RegisterUserDto) {
        const result = await this.authService.register(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @IsPublic()
    @Post("verify-registration")
    @ApiOperation({ summary: "Verify Registration" })
    async verifyRegistration(@Body() payload: VerifyRegistrationDto) {
        const result = await this.authService.verifyRegistration(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @IsPublic()
    @Post("login")
    @ApiOperation({ summary: "Login User" })
    async loginWithEmail(@Body() payload: LoginUserDto) {
        const result = await this.authService.loginWithEmail(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @IsPublic()
    @Post("send-otp/password-reset")
    @ApiOperation({ summary: "Forgot Password OTP" })
    async sendForgotPasswordOtp(@Body() payload: SendForgotPasswordOtpDto) {
        const result = await this.authService.sendForgotPasswordOtp(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @IsPublic()
    @Post("verify-otp/password-reset")
    @ApiOperation({ summary: "Verify OTP" })
    async verifyOTP(@Body() payload: VerifyForgotPasswordOtpDto) {
        const result = await this.authService.verifyOTP(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Post("reset-password")
    @ApiOperation({ summary: "Reset Password" })
    async resetPassword(
        @Body() payload: ResetPasswordDto,
        @Req() req: Request,
    ) {
        const user = req.user as UserPayload;
        console.log(user);
        const result = await this.authService.resetPassword(payload, user);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Post("change-password")
    @ApiOperation({ summary: "Change Password" })
    async changePassword(
        @Body() payload: ChangePasswordDto,
        @Req() req: Request,
    ) {
        const result = await this.authService.changePassword(
            payload,
            req.user as UserPayload,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @HttpCode(HttpStatus.OK)
    @IsPublic()
    @Post("refresh-token")
    @ApiOperation({ summary: "Refresh Access Token" })
    async refreshToken(@Body() payload: RefreshTokenDto) {
        const result = await this.authService.refreshToken(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Post("create-producer-profile")
    @Roles(UserRole.PRODUCER)
    @UseInterceptors(
        CustomFileFieldsInterceptor([
            { name: "landCertificate", maxCount: 1 },
            { name: "farmPhotoUrl", maxCount: 1 },
            { name: "companyCertificate", maxCount: 1 },
            { name: "rcmUrl", maxCount: 1 },
            { name: "taxUrl", maxCount: 1 },
            { name: "nidUrl", maxCount: 1 },
        ]),
        ParseFormDataInterceptor,
    )
    @ApiOperation({ summary: "Create Producer Profile" })
    async createProducerProfile(
        @Body() payload: CreateProducerProfileDto,
        @Req() req: Request,
        @UploadedFiles()
        files?: {
            landCertificate?: Express.Multer.File[];
            farmPhotoUrl?: Express.Multer.File[];
            companyCertificate?: Express.Multer.File[];
            rcmUrl?: Express.Multer.File[];
            taxUrl?: Express.Multer.File[];
            nidUrl?: Express.Multer.File[];
        },
    ) {
        const user = req.user as UserPayload;
        const result = await this.authService.createProducerProfile(
            user,
            payload,
            files,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Post("create-driver-profile")
    @Roles(UserRole.DRIVER)
    @UseInterceptors(
        CustomFileFieldsInterceptor([
            { name: "licenseUrl", maxCount: 1 },
            { name: "nidUrl", maxCount: 1 },
        ]),
        ParseFormDataInterceptor,
    )
    @ApiOperation({ summary: "Create Driver Profile" })
    async createDriverProfile(
        @Body() payload: CreateDriverProfileDto,
        @Req() req: Request,
        @UploadedFiles()
        files?: {
            licenseUrl?: Express.Multer.File[];
            nidUrl?: Express.Multer.File[];
        },
    ) {
        const user = req.user as UserPayload;
        const result = await this.authService.createDriverProfile(
            user,
            payload,
            files,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Put("update-profile")
    @Roles(UserRole.DRIVER, UserRole.PRODUCER, UserRole.BUYER)
    @UseInterceptors(
        CustomFileInterceptor("profileImage"),
        ParseFormDataInterceptor,
    )
    @ApiOperation({ summary: "Update user Profile" })
    async updateUserProfile(
        @Body() payload: updateUserDto,
        @Req() req: Request,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const user = req.user as UserPayload;
        const result = await this.authService.updateProfile(
            user,
            payload,
            file,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }
}
