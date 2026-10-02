import {
    Body,
    Controller,
    Delete,
    Get,
    HttpStatus,
    Param,
    Patch,
    Post,
    Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserPayload } from "@/common/guards/auth.guard";
import { Request } from "express";
import { ResponseService } from "@/common/interceptors/response";
import { Roles } from "@/common/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { ShoppingService } from "./shopping.service";
import { CartDto, UpdateCartDto } from "./dto/body.dto";

@ApiTags("Shopping")
@Controller("shopping")
export class ShoppingController {
    constructor(private shoppingService: ShoppingService) {}

    @Post("add-cart")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Add Product to Cart" })
    async addProductToCart(@Body() payload: CartDto, @Req() req: Request) {
        const result = await this.shoppingService.addProductToCart(
            req.user as UserPayload,
            payload,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Get("cart")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Get User Cart Items" })
    async getUserCartItems(@Req() req: Request) {
        const result = await this.shoppingService.getUserCartItems(
            req.user as UserPayload,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Patch("update-cart")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Update Cart Item Quantity" })
    async updateCartItemQuantity(
        @Body() payload: UpdateCartDto,
        @Req() req: Request,
    ) {
        const result = await this.shoppingService.updateCartItemQuantity(
            req.user as UserPayload,
            payload,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Delete("remove-cart/:id")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Remove Product from Cart" })
    async removeProductFromCart(@Req() req: Request, @Param("id") id: string) {
        const result = await this.shoppingService.removeProductFromCart(
            req.user as UserPayload,
            id,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    //wishlist related apis

    @Post("add-wishlist/:id")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Add Product to Wishlist" })
    async addProductToWishlist(@Param("id") id: string, @Req() req: Request) {
        const result = await this.shoppingService.addProductToWishlist(
            req.user as UserPayload,
            id,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }

    @Get("wishlist")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Get User Wishlist Items" })
    async getUserWishlistItems(@Req() req: Request) {
        const result = await this.shoppingService.getUserWishlistItems(
            req.user as UserPayload,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
            data: result.data,
        });
    }

    @Delete("remove-wishlist/:id")
    @Roles(UserRole.BUYER)
    @ApiOperation({ summary: "Remove Product from Wishlist" })
    async removeProductFromWishlist(
        @Req() req: Request,
        @Param("id") id: string,
    ) {
        const result = await this.shoppingService.removeProductFromWishlist(
            req.user as UserPayload,
            id,
        );
        return ResponseService.formatResponse({
            statusCode: HttpStatus.OK,
            message: result.message,
        });
    }
}
