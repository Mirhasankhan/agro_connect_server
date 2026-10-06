import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { UserPayload } from "@/common/guards/auth.guard";
import {
    PricingTierDto,
    ProductDto,
    ProductQueryDto,
    UpdateProductDto,
    UpdateProductImagesDto,
} from "./dto/body.dto";
import { FileService } from "@/core/services/files/cloudinary.service";
import { ApiError } from "@/common/errors/api_error";
import QueryBuilder from "@/common/utils/queryBuilder";
import { UserRole } from "@prisma/client";

@Injectable()
export class ProductService {
    constructor(
        private prisma: PrismaService,
        private fileService: FileService,
    ) {}

    async createNewProduct(
        user: UserPayload,
        payload: ProductDto,
        files?: Express.Multer.File[],
    ) {
        await this.prisma.user.findUniqueOrThrow({
            where: {
                id: user.id,
                role: UserRole.PRODUCER,
                producerProfile: {
                    verificationStatus: "Accepted",
                },
            },
            select: {
                id: true,
            },
        });

        await this.prisma.category.findUniqueOrThrow({
            where: {
                id: payload.categoryId,
                isActive: true,
            },
            select: {
                id: true,
            },
        });

        let imageUrls: string[] = [];

        if (files && files.length > 0) {
            imageUrls =
                await this.fileService.uploadMultipleToCloudinary(files);
        }

        if (!imageUrls.length) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "At least one product image is required",
            );
        }

        const { pricingTiers, ...productData } = payload;

        await this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    ...productData,
                    producerId: user.id,
                    imageUrls,
                },
            });

            if (pricingTiers?.length) {
                await tx.pricingTier.createMany({
                    data: pricingTiers.map((tier) => ({
                        productId: product.id,
                        quantity: tier.quantity,
                        pricePerUnit: tier.pricePerUnit,
                    })),
                });
            }
        });

        return {
            message: "Product created successfully",
        };
    }

    async getAllProducts(user?: UserPayload, query?: ProductQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.product, query);

        const response = queryBuilder
            .search(["name", "description"])
            .filter({
                exacts: ["categoryId", "sellingUnit"],
            })
            .rawFilter({
                isActive: true,
                availableQuantity: {
                    gt: 0,
                },
                category: {
                    isActive: true,
                },
            })
            .range([
                {
                    field: "pricePerUnit",
                    startKey: "minPrice",
                    endKey: "maxPrice",
                    type: "number",
                },
            ])
            .sort()
            .paginate()
            .select({
                id: true,
                name: true,
                pricePerUnit: true,
                imageUrls: true,
                availableQuantity: true,
                wishlists: user?.id
                    ? {
                          where: { userId: user.id },
                          select: { id: true },
                      }
                    : false,
            });

        const [products, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            message: "Products fetched successfully",
            data: {
                products,
                meta: pagination,
            },
        };
    }

    async getProductByProducer(user: UserPayload, query?: ProductQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.product, query);

        const response = queryBuilder
            .search(["name", "description"])
            .rawFilter({
                producerId: user.id,
            })
            .paginate()
            .sort()
            .select({
                id: true,
                imageUrls: true,
                name: true,
                pricePerUnit: true,
                availableQuantity: true,
                sellingUnit: true,
                sold: true,
                category: {
                    select: {
                        name: true,
                    },
                },
            });

        const status = query?.status;

        if (status === "active") {
            response.rawFilter({
                availableQuantity: {
                    gt: 0,
                },
            });
        }

        if (status === "outOfStock") {
            response.rawFilter({
                availableQuantity: 0,
            });
        }

        const [products, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            message: "Products fetched successfully",
            data: {
                products,
                meta: pagination,
            },
        };
    }

    async getProductById(productId: string, user?: UserPayload) {
        const product = await this.prisma.product.findUniqueOrThrow({
            where: {
                id: productId,
            },
            select: {
                id: true,
                name: true,
                description: true,
                sellingUnit: true,
                pricePerUnit: true,
                availableQuantity: true,
                imageUrls: true,
                avgRating: true,
                createdAt: true,
                isActive: true,
                _count: {
                    select: {
                        orderItems: true,
                    },
                },
                totalReviews: true,
                category: {
                    select: {
                        name: true,
                    },
                },
                pricingTiers: {
                    select: {
                        pricePerUnit: true,
                        quantity: true,
                    },
                },
                reviews: {
                    select: {
                        rating: true,
                        comment: true,
                        createdAt: true,
                        buyer: {
                            select: {
                                fullName: true,
                                profileImage: true,
                            },
                        },
                    },
                },
                wishlists: user?.id
                    ? {
                          where: { userId: user.id },
                          select: { id: true },
                      }
                    : false,
            },
        });

        const revenue = await this.prisma.orderItem.aggregate({
            where: {
                productId: product.id,
                order: {
                    status: "Delivered",
                },
            },
            _sum: {
                subtotal: true,
            },
        });

        return {
            message: "Product fetched successfully",
            data: {
                product,
                revenue: revenue._sum.subtotal ?? 0,
            },
        };
    }

    async addNewPricingTier(user: UserPayload, payload: PricingTierDto) {
        const product = await this.prisma.product.findUniqueOrThrow({
            where: {
                id: payload.productId,
                producerId: user.id,
            },
            select: {
                id: true,
                pricingTiers: {
                    select: {
                        quantity: true,
                    },
                },
            },
        });

        const tierAlreadyExists = product.pricingTiers.some(
            (tier) => tier.quantity === payload.quantity,
        );

        if (tierAlreadyExists) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "A pricing tier with this quantity already exists",
            );
        }

        await this.prisma.pricingTier.create({
            data: {
                productId: payload.productId,
                quantity: payload.quantity,
                pricePerUnit: payload.pricePerUnit,
            },
        });

        return {
            message: "Pricing tier added successfully",
        };
    }

    async updateProduct(user: UserPayload, payload: UpdateProductDto) {
        const product = await this.prisma.product.findUniqueOrThrow({
            where: {
                id: payload.productId,
                producerId: user.id,
            },
            select: {
                id: true,
                name: true,
                description: true,
                categoryId: true,
                sellingUnit: true,
                pricePerUnit: true,
                availableQuantity: true,
                isActive: true,
                isFeatured: true,
            },
        });

        delete payload.productId;

        await this.prisma.product.update({
            where: {
                id: product.id,
            },
            data: {
                ...payload,
            },
        });

        return {
            message: "Product updated successfully",
        };
    }

    async updateProductImages(
        user: UserPayload,
        payload: UpdateProductImagesDto,
        files: Express.Multer.File[] = [],
    ) {
        const product = await this.prisma.product.findUniqueOrThrow({
            where: {
                id: payload.productId,
                producerId: user.id,
            },
            select: {
                id: true,
                imageUrls: true,
            },
        });

        const keptImages = payload.keptImages ?? [];
        const validKeptImages = keptImages.every((image) =>
            product.imageUrls.includes(image),
        );

        if (!validKeptImages) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "Some of the kept images are not valid for this product",
            );
        }

        const uploadedImages = files.length
            ? await this.fileService.uploadMultipleToCloudinary(files)
            : [];
        const finalImages = [...keptImages, ...uploadedImages];

        if (!finalImages.length) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "At least one product image is required",
            );
        }

        const deletedImages = product.imageUrls.filter(
            (image) => !finalImages.includes(image),
        );

        try {
            await this.prisma.product.update({
                where: {
                    id: product.id,
                },
                data: {
                    imageUrls: finalImages,
                },
            });
        } catch (error) {
            if (uploadedImages.length) {
                await this.fileService
                    .deleteMultipleFromCloudinary(uploadedImages)
                    .catch(() => undefined);
            }
            throw error;
        }

        if (deletedImages.length) {
            await this.fileService.deleteMultipleFromCloudinary(deletedImages);
        }

        return {
            message: "Product images updated successfully",
        };
    }
}
