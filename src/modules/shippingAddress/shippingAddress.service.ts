import { PrismaService } from "@/core/services/prisma/prisma.service";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ShippingAddressDto } from "./dto/body.dto";
import { UserPayload } from "@/common/guards/auth.guard";
import QueryBuilder from "@/common/utils/queryBuilder";

@Injectable()
export class ShippingAddressService {
    constructor(private prisma: PrismaService) { }

    async createShippingAddress(
        payload: ShippingAddressDto,
        user: UserPayload,
    ) {
        const { addressLine, city, country, instruction, postCode } = payload;

        await this.prisma.shippingAddress.create({
            data: {
                userId: user.id,
                addressLine,
                city,
                country,
                instruction,
                postCode,
            },
        });
        return {
            message: "Shipping Address created successfully!",
        };
    }

    async getShippingAddress(user: UserPayload, query: any) {

        const shippingAddresses = await this.prisma.shippingAddress.findMany({
            where: {
                userId: user.id,
            },
            select: {
                id: true,
                addressLine: true,
                city: true,
                country: true,
                instruction: true,
                postCode: true,
            }
        })
        return {
            data: shippingAddresses,
            message: "Shipping Address fetched successfully!",
        };
    }
}
