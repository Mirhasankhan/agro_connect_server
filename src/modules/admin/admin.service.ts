import QueryBuilder from "@/common/utils/queryBuilder";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { HttpStatus, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
    AcceptRejectAccountDto,   
    CategoryDto,
    DriverQueryDto,
    ProducerQueryDto,  
} from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";
import { FileService } from "@/core/services/files/cloudinary.service";

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private fileService: FileService,
    ) {}

    async getAllProducerFromDB(query: ProducerQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.user, query);

        const response = queryBuilder
            .search(["email", "fullName", "phone"])
            .filter({
                exacts: ["verificationStatus", "producerType"],
                nestedFields: {
                    verificationStatus: "producerProfile.verificationStatus",
                    producerType: "producerProfile.producerType",
                },
            })
            .rawFilter({
                role: {
                    equals: UserRole.PRODUCER,
                },
            })
            .sort()
            .paginate()
            .select({
                fullName: true,
                email: true,
                profileImage: true,
                phone: true,
                producerProfile: {
                    omit: {
                        updatedAt: true,
                        userId: true,
                    },
                },
            });

        const [allProducer, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            data: {
                users: allProducer,
                meta: pagination,
            },
            message: "All producer fetched successfully",
        };
    }

    async acceptRejectProducerAccount(payload: AcceptRejectAccountDto) {
        await this.prisma.producerProfile.findUniqueOrThrow({
            where: {
                userId: payload.accountId,
                verificationStatus: "Pending",
            },
        });

        if (!payload.isAccept && !payload.rejectReason) {
            throw new ApiError(
                HttpStatus.FORBIDDEN,
                "Reject reason is required",
            );
        }

        await this.prisma.producerProfile.update({
            where: { userId: payload.accountId },
            data: {
                verificationStatus: payload.isAccept ? "Accepted" : "Rejected",
                rejectionReason: payload.rejectReason,
            },
        });

        return {
            message: `${payload.isAccept ? "Accepted" : "Rejected"} producer account successfully`,
        };
    }

    async getAllDriverFromDB(query: DriverQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.user, query);

        const response = queryBuilder
            .search(["email", "fullName", "phone"])
            .filter({
                exacts: ["vehicleType", "verificationStatus"],
                nestedFields: {
                    vehicleType: "driverProfile.vehicleType",
                    verificationStatus: "driverProfile.verificationStatus",
                },
            })
            .rawFilter({
                role: {
                    equals: UserRole.DRIVER,
                },
            })
            .sort()
            .paginate()
            .select({
                fullName: true,
                email: true,
                profileImage: true,
                phone: true,
                driverProfile: {
                    omit: {
                        updatedAt: true,
                        userId: true,
                    },
                },
            });

        const [allDriver, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            data: {
                users: allDriver,
                meta: pagination,
            },
            message: "All driver fetched successfully",
        };
    }

     async acceptRejectDriverAccount(payload: AcceptRejectAccountDto) {
        await this.prisma.driverProfile.findUniqueOrThrow({
            where: {
                userId: payload.accountId,
                verificationStatus: "Pending",
            },
        });

        if (!payload.isAccept && !payload.rejectReason) {
            throw new ApiError(
                HttpStatus.FORBIDDEN,
                "Reject reason is required",
            );
        }

        await this.prisma.driverProfile.update({
            where: { userId: payload.accountId },
            data: {
                verificationStatus: payload.isAccept ? "Accepted" : "Rejected",
                rejectionReason: payload.isAccept ? null : payload.rejectReason,
            },
        });

        return {
            message: `${payload.isAccept ? "Accepted" : "Rejected"} driver account successfully`,
        };
    }

    async createNewCategory(payload: CategoryDto, file?: Express.Multer.File) {
        const existingCategory = await this.prisma.category.findUnique({
            where: {
                slug: payload.slug,
            },
            select: {
                slug: true,
            },
        });

        if (existingCategory) {
            throw new ApiError(HttpStatus.CONFLICT, "Category already exists");
        }

        let imageUrl = null;
        if (file) {
            imageUrl = await this.fileService.uploadToCloudinary(file);
        }

        if (!imageUrl) {
            throw new ApiError(HttpStatus.BAD_REQUEST, "Image upload failed");
        }

        await this.prisma.category.create({
            data: {
                ...payload,
                imageUrl,
            },
        });

        return {
            message: "Category created successfully",
        };
    }

    async toggleCategoryStatus(categoryId: string) {
        const category = await this.prisma.category.findUniqueOrThrow({
            where: {
                id: categoryId,
            },
            select: {
                id: true,
                isActive: true,
            },
        });

        await this.prisma.category.update({
            where: {
                id: categoryId,
            },
            data: {
                isActive: !category.isActive,
            },
        });

        return {
            message: `Category ${category.isActive ? "Deactived" : "Actived"} successfully`,
        };
    }
}
