import { UserPayload } from "@/common/guards/auth.guard";
import { ApiError } from "@/common/errors/api_error";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { HttpStatus, Injectable } from "@nestjs/common";
import { CartDto, UpdateCartDto } from "./dto/body.dto";

@Injectable()
export class ShoppingService {
    constructor(private prisma: PrismaService) {}

    async addProductToCart(user: UserPayload, payload: CartDto) {
        const product = await this.prisma.product.findUniqueOrThrow({
            where: {
                id: payload.productId,
            },
            select: {
                id: true,
                availableQuantity: true,
            },
        });

        const existingCart = await this.prisma.cart.findUnique({
            where: {
                userId_productId: {
                    userId: user.id,
                    productId: payload.productId,
                },
            },
            select: {
                id: true,
                quantity: true,
            },
        });

        const totalQuantity = (existingCart?.quantity ?? 0) + payload.quantity;
        if (totalQuantity > product.availableQuantity) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                `Only ${product.availableQuantity} units of this product are available`,
            );
        }

        if (existingCart) {
            await this.prisma.cart.update({
                where: {
                    id: existingCart.id,
                },
                data: {
                    quantity: {
                        increment: payload.quantity,
                    },
                },
            });

            return {
                message: "Product added to cart successfully",
            };
        }

        await this.prisma.cart.create({
            data: {
                userId: user.id,
                productId: payload.productId,
                quantity: payload.quantity,
            },
        });

        return {
            message: "Product added to cart successfully",
        };
    }

    async getUserCartItems(user: UserPayload) {
        const cartItems = await this.prisma.cart.findMany({
            where: {
                userId: user.id,
            },
            select: {
                id: true,
                quantity: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        pricePerUnit: true,
                        imageUrls: true,
                        pricingTiers: {
                            select: {
                                pricePerUnit: true,
                                quantity: true,
                            },
                        },
                    },
                },
            },
        });

        return {
            message: "Cart items retrieved successfully",
            data: cartItems,
        };
    }

    async updateCartItemQuantity(user: UserPayload, payload: UpdateCartDto) {
        const cartItem = await this.prisma.cart.findFirstOrThrow({
            where: {
                id: payload.cartId,
                userId: user.id,
            },
            select: {
                id: true,
                quantity: true,
                product: {
                    select: {
                        availableQuantity: true,
                    },
                },
            },
        });

        if (payload.increment) {
            const updatedCart = await this.prisma.cart.updateMany({
                where: {
                    id: payload.cartId,
                    userId: user.id,
                    quantity: {
                        lt: cartItem.product.availableQuantity,
                    },
                },
                data: {
                    quantity: {
                        increment: 1,
                    },
                },
            });

            if (updatedCart.count === 0) {
                throw new ApiError(
                    HttpStatus.BAD_REQUEST,
                    `Only ${cartItem.product.availableQuantity} units of this product are available`,
                );
            }

            return {
                message: "Cart item quantity increased successfully",
            };
        }

        if (cartItem.quantity <= 1) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Quantity cannot be less than 1",
            );
        }

        await this.prisma.cart.updateMany({
            where: {
                id: payload.cartId,
                userId: user.id,
                quantity: {
                    gt: 1,
                },
            },
            data: {
                quantity: {
                    decrement: 1,
                },
            },
        });

        return {
            message: "Cart item quantity decreased successfully",
        };
    }

    async removeProductFromCart(user: UserPayload, cartId: string) {
        await this.prisma.cart.delete({
            where: {
                id: cartId,
                userId: user.id,
            },
        });

        return {
            message: "Product removed from cart successfully",
        };
    }

    //wishlist related methods will be added here in future

    async addProductToWishlist(user: UserPayload, productId: string) {
        await this.prisma.product.findUniqueOrThrow({
            where: {
                id: productId,
            },
            select: {
                id: true,
            },
        });

        const existingWishlist = await this.prisma.wishlist.findUnique({
            where: {
                userId_productId: {
                    userId: user.id,
                    productId,
                },
            },
            select: {
                id: true,
            },
        });

        if (existingWishlist) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Product is already in your wishlist",
            );
        }

        await this.prisma.wishlist.create({
            data: {
                userId: user.id,
                productId,
            },
        });

        return {
            message: "Product added to wishlist successfully",
        };
    }

    async getUserWishlistItems(user: UserPayload) {
        const wishlistItems = await this.prisma.wishlist.findMany({
            where: {
                userId: user.id,
            },
            select: {
                id: true,
                product: {
                    select: {
                        id: true,
                        name: true,
                        pricePerUnit: true,
                        imageUrls: true,
                        pricingTiers: {
                            select: {
                                pricePerUnit: true,
                                quantity: true,
                            },
                        },
                    },
                },
            },
        });

        return {
            message: "Wishlist items retrieved successfully",
            data: wishlistItems,
        };
    }

    async removeProductFromWishlist(user: UserPayload, wishlistId: string) {
        await this.prisma.wishlist.delete({
            where: {
                id: wishlistId,
                userId: user.id,
            },
        });

        return {
            message: "Product removed from wishlist successfully",
        };
    }
}
