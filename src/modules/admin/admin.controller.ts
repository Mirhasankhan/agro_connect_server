import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { ResponseService } from "@/common/interceptors/response";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import {
    AcceptRejectAccountDto,
    CategoryDto,
    DriverQueryDto,
    ProducerQueryDto,
    AssignDriverDto,
} from "./dto/body.dto";
import { CustomFileInterceptor } from "@/common/interceptors/file_interceptors";
import { ParseFormDataInterceptor } from "@/common/interceptors/form_data_interceptor";
import { IsPublic } from "@/common/decorators/auth.decorator";

@ApiTags("Admin")
@Controller("admin")
export class AdminController {
    constructor(private adminService: AdminService) {}

    @Get("all-producers")
    @ApiOperation({ summary: "All producers" })
    @Roles(UserRole.ADMIN)
    async allProducers(@Query() query: ProducerQueryDto) {
        const result = await this.adminService.getAllProducerFromDB(query);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Patch("producer-approval")
    @ApiOperation({ summary: "Accept/reject producer account" })
    @Roles(UserRole.ADMIN)
    async acceptRejectProducerAccount(@Body() payload: AcceptRejectAccountDto) {
        const result =
            await this.adminService.acceptRejectProducerAccount(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Get("all-drivers")
    @ApiOperation({ summary: "All drivers" })
    @Roles(UserRole.ADMIN)
    async allDrivers(@Query() query: DriverQueryDto) {
        const result = await this.adminService.getAllDriverFromDB(query);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Patch("driver-approval")
    @ApiOperation({ summary: "Accept/reject driver account" })
    @Roles(UserRole.ADMIN)
    async acceptRejectDriverAccount(@Body() payload: AcceptRejectAccountDto) {
        const result = await this.adminService.acceptRejectDriverAccount(payload);            

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Post("create-category")
    @ApiOperation({ summary: "Create new category" })
    @Roles(UserRole.ADMIN)
    @UseInterceptors(
        CustomFileInterceptor("imageUrl"),
        ParseFormDataInterceptor,
    )
    async createNewCategory(
        @Body() payload: CategoryDto,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const result = await this.adminService.createNewCategory(payload, file);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Patch("toggle-category-status/:id")
    @ApiOperation({ summary: "Toggle category status" })
    @Roles(UserRole.ADMIN)
    async toggleCategoryStatus(@Param("id") id: string) {
        const result = await this.adminService.toggleCategoryStatus(id);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @IsPublic()
    @Post("assign-driver")
    @ApiOperation({ summary: "Assign driver to delivery" })
    @Roles(UserRole.ADMIN)
    async assignDriverToDelivery(@Body() payload: AssignDriverDto) {
        const result = await this.adminService.assignDriverToDelivery(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }
}
