import { PrismaService } from "@/core/services/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { UserPayload } from "@/common/guards/auth.guard";
import QueryBuilder from "@/common/utils/queryBuilder";
import { PaymentQueryDto } from "./dto/body.dto";

@Injectable()
export class PaymentService {
    constructor(private prisma: PrismaService) {}

    async getProducerWisePayments(user: UserPayload, query: PaymentQueryDto) {
        const queryBuilder = new QueryBuilder(
            this.prisma.producerEarning,
            query,
        );

        const response = queryBuilder
            .search(["orderItem.productName"])
            .filter({
                booleans: ["isTransferred"],
            })
            .rawFilter({ producerId: user.id })
            .paginate()
            .sortBy({ createdAt: "desc" })
            .select({
                id: true,
                amount: true,
                isTransferred: true,
                createdAt: true,
                paidAt: true,
                orderItem: {
                    select: {
                        productName: true,
                        quantity: true,
                        sellingUnit: true,
                        unitPrice: true,
                        subtotal: true,
                    },
                },
            });

        const [payments, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            message: "Producer wise payments fetched successfully",
            data: {
                payments,
                pagination,
            },
        };
    }

    async getDriverWisePayments(user: UserPayload, query: PaymentQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.driverEarning, query);

        const response = queryBuilder
            .search(["order.orderId"])
            .filter({
                booleans: ["isTransferred"],
            })
            .rawFilter({ driverId: user.id })
            .paginate()
            .sortBy({ createdAt: "desc" })
            .select({
                id: true,
                amount: true,
                isTransferred: true,
                createdAt: true,
                paidAt: true,
                order: {
                    select: {
                        id: true,
                        orderId: true,
                        items: {
                            select: {
                                productName: true,
                                quantity: true,
                                sellingUnit: true,
                                unitPrice: true,
                                subtotal: true,                                
                            },
                        },
                    },
                },
            });

        const [payments, pagination] = await Promise.all([
            response.execute(),
            response.countTotal(),
        ]);

        return {
            message: "Driver wise payments fetched successfully",
            data: {
                payments,
                pagination,
            },
        };
    }

    
}
