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
    BaseUserQueryDto,
    CreateCouponDto,
    UpdateTermsDto,
    CreateAdminNotificationDto,
    AdminNotificationQueryDto,
    DeliveryQueryDto,
    SupportQueryDto,
} from "./dto/body.dto";
import { CustomFileInterceptor } from "@/common/interceptors/file_interceptors";
import { ParseFormDataInterceptor } from "@/common/interceptors/form_data_interceptor";
import { IsPublic } from "@/common/decorators/auth.decorator";
import { OrderQueryDto } from "../order/dto/body.dto";
import { EarningSummaryQueryDto } from "../payment/dto/body.dto";

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

    @Get("all-buyers")
    @ApiOperation({ summary: "All buyers" })
    @Roles(UserRole.ADMIN)
    async allBuyers(@Query() query: BaseUserQueryDto) {
        const result = await this.adminService.getAllBuyerFromDB(query);

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
        const result =
            await this.adminService.acceptRejectDriverAccount(payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Post("create-category")
    @ApiOperation({ summary: "Create new category" })
    @IsPublic()
    // @Roles(UserRole.ADMIN)
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

    @Get("all-categories")
    @IsPublic()
    @ApiOperation({ summary: "All categories" })
    @Roles(UserRole.ADMIN)
    async allCategories() {
        const result = await this.adminService.getAllCategories();

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
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

    @Post("create-coupon")
    @ApiOperation({ summary: "Create new coupon" })
    @Roles(UserRole.ADMIN)
    async createNewCoupon(@Body() payload: CreateCouponDto) {
        const result = await this.adminService.createNewCoupon(payload);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Patch("update-terms")
    @ApiOperation({ summary: "Update terms and conditions" })
    @Roles(UserRole.ADMIN)
    async updateTerms(@Body() content: UpdateTermsDto) {
        const result = await this.adminService.updateTerms(content);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Get("all-orders")
    @ApiOperation({ summary: "All orders" })
    @Roles(UserRole.ADMIN)
    async allOrders(@Query() query: OrderQueryDto) {
        const result = await this.adminService.getAllOrdersFromDB(query);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("order/:id")
    @ApiOperation({ summary: "Get order by ID" })
    @Roles(UserRole.ADMIN)
    async getOrderById(@Param("id") orderId: string) {
        const result = await this.adminService.getOrderById(orderId);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("overview")
    @ApiOperation({ summary: "Get admin overview data" })
    @Roles(UserRole.ADMIN)
    async getAdminOverviewData() {
        const result = await this.adminService.getAdminOverviewData();
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("revenue-summary")
    @ApiOperation({ summary: "Get admin revenue summary" })
    @Roles(UserRole.ADMIN)
    async getRevenueSummary(@Query() query: EarningSummaryQueryDto) {
        const result = await this.adminService.getRevenusSummary(query);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Post("notifications")
    @ApiOperation({ summary: "Send a notification to users" })
    @Roles(UserRole.ADMIN)
    async sendNotification(@Body() payload: CreateAdminNotificationDto) {
        const result = await this.adminService.sendNotification(payload);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("notifications")
    @ApiOperation({ summary: "Get sent admin notifications" })
    @Roles(UserRole.ADMIN)
    async getSentNotifications(@Query() query: AdminNotificationQueryDto) {
        const result = await this.adminService.getSentNotifications(query);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("all-deliveries")
    @ApiOperation({ summary: "Get all deliveries" })
    @Roles(UserRole.ADMIN)
    async getAllDeliveries(@Query() query: DeliveryQueryDto) {
        const result = await this.adminService.getAllDeliveries(query);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("delivery-details/:id")
    @ApiOperation({ summary: "Get delivery details" })
    @Roles(UserRole.ADMIN)
    async getDeliveryDetails(@Param("id") deliveryId: string) {
        const result = await this.adminService.getDeliveryDetails(deliveryId);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("support-messages")
    @ApiOperation({ summary: "Get all support messages" })
    @Roles(UserRole.ADMIN)
    async getAllSupportMessages(@Query() query: SupportQueryDto) {
        const result = await this.adminService.getAllSupportMessages(query);
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }
}
