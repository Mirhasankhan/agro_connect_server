import { ProductService } from "./product.service";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    Post,
    Put,
    Query,
    Req,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { CustomFilesInterceptor } from "@/common/interceptors/file_interceptors";
import { ParseFormDataInterceptor } from "@/common/interceptors/form_data_interceptor";
import {
    ProductDto,
    ProductQueryDto,
    UpdateProductDto,
    UpdateProductImagesDto,
} from "./dto/body.dto";
import { ResponseService } from "@/common/interceptors/response";
import { UserPayload } from "@/common/guards/auth.guard";
import { Request } from "express";
import { OptionalAuth } from "@/common/decorators/auth.decorator";

@ApiTags("Product")
@Controller("product")
export class ProductController {
    constructor(private productService: ProductService) {}

    @Post("create")
    @ApiOperation({ summary: "Create new product" })
    @Roles(UserRole.PRODUCER)
    @UseInterceptors(
        CustomFilesInterceptor("imageUrls"),
        ParseFormDataInterceptor,
    )
    async createNewCategory(
        @Req() req: Request,
        @Body() payload: ProductDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        const user = req.user as UserPayload;
        const result = await this.productService.createNewProduct(
            user,
            payload,
            files,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Get("all")
    @Roles(UserRole.PRODUCER, UserRole.BUYER)
    @OptionalAuth()
    @ApiOperation({ summary: "Get all products" })
    async getAllProducts(@Req() req: Request, @Query() query: ProductQueryDto) {
        const user = req.user as UserPayload;
        const result = await this.productService.getAllProducts(user, query);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("producer-wise")
    @Roles(UserRole.PRODUCER)
    @OptionalAuth()
    @ApiOperation({ summary: "Get all products by producer" })
    async getAllProductsByProducer(@Req() req: Request, @Query() query: ProductQueryDto) {
        const user = req.user as UserPayload;
        const result = await this.productService.getProductByProducer(user, query);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Get("details/:id")
    @Roles(UserRole.BUYER)
    @OptionalAuth()
    @ApiOperation({ summary: "Get product details by ID" })
    async getProductDetails(@Req() req: Request, @Param("id") id: string) {
        const user = req.user as UserPayload;
        const result = await this.productService.getProductById(id, user);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }



    @Put("update")
    @Roles(UserRole.PRODUCER)
    @ApiOperation({ summary: "Update product details" })
    async updateProduct(
        @Req() req: Request,
        @Body() payload: UpdateProductDto,
    ) {
        const user = req.user as UserPayload;
        const result = await this.productService.updateProduct(user, payload);

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Put("update-images")
    @Roles(UserRole.PRODUCER)
    @ApiOperation({ summary: "Update product images" })
    @UseInterceptors(
        CustomFilesInterceptor("imageUrls"),
        ParseFormDataInterceptor,
    )
    async updateProductImages(
        @Req() req: Request,
        @Body() payload: UpdateProductImagesDto,
        @UploadedFiles() files: Express.Multer.File[] = [],
    ) {
        const result = await this.productService.updateProductImages(
            req.user as UserPayload,
            payload,
            files,
        );

        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }
}



