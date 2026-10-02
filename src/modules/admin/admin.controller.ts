import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { Request } from "express";
import { ResponseService } from "@/common/interceptors/response";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { AcceptRejectProducerAccountDto, CategoryDto } from "./dto/body.dto";
import { CustomFileInterceptor } from "@/common/interceptors/file_interceptors";
import { ParseFormDataInterceptor } from "@/common/interceptors/form_data_interceptor";

@ApiTags("Admin")
@Controller("admin")
export class AdminController {
    constructor(private adminService: AdminService) { }

    @Get("all-producers")
    @ApiOperation({ summary: "All" })
    @Roles(UserRole.ADMIN)

    async register(@Req() req: Request) {
        const result = await this.adminService.getAllProducerFromDB(req.query);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Patch("accept-reject-producer-account")
    @ApiOperation({ summary: "Accept/reject producer account" })
    @Roles(UserRole.ADMIN)

    async acceptRejectProducerAccount(@Body() payload: AcceptRejectProducerAccountDto) {
        const result = await this.adminService.acceptRejectProducerAccount(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message
        });
    }

    @Post("create-category")
    @ApiOperation({ summary: "Create new category" })
    @Roles(UserRole.ADMIN)
    @UseInterceptors(
        CustomFileInterceptor("imageUrl"),
        ParseFormDataInterceptor,
    )

    async createNewCategory(@Body() payload: CategoryDto, @UploadedFile() file?: Express.Multer.File) {
        const result = await this.adminService.createNewCategory(payload, file);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message
        });
    }

    @Patch("toggle-category-status/:id")
    @ApiOperation({ summary: "Toggle category status" })
    @Roles(UserRole.ADMIN)

    async toggleCategoryStatus(@Param("id") id: string) {
        const result = await this.adminService.toggleCategoryStatus(id);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message
        });
    }
}