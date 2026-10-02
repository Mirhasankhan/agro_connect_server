import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { IsPublic } from "@/common/decorators/auth.decorator";
import { Request } from "express";
import { ResponseService } from "@/common/interceptors/response";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
    ChangePasswordDto,
    CreateProducerProfileDto,
    LoginUserDto,
    RefreshTokenDto,
    RegisterUserDto,
    ResetPasswordDto,
    SendForgotPasswordOtpDto,
    VerifyForgotPasswordOtpDto,
    VerifyRegistrationDto,
} from "./dto/body.dto";
import { UserPayload } from "@/common/guards/auth.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CustomFileInterceptor } from "@/common/interceptors/file_interceptors";
import { ParseFormDataInterceptor } from "@/common/interceptors/form_data_interceptor";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
    constructor(private authService: AuthService) { }

    @HttpCode(HttpStatus.CREATED)
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
    @Roles("PRODUCER")
    @UseInterceptors(
        CustomFileInterceptor("tradeLicense"),
        ParseFormDataInterceptor,
    )
    @ApiOperation({ summary: "Create Producer Profile" })
    async createProducerProfile(
        @Body() payload: CreateProducerProfileDto,
        @Req() req: Request,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const user = req.user as UserPayload;
        const result = await this.authService.createProducerProfile(
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
