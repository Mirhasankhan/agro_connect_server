import { UserPayload } from "@/common/guards/auth.guard";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { HttpStatus, Injectable } from "@nestjs/common";
import {
    EarningSummaryQueryDto,
    EarningSummaryType,
    WithdrawQueryDto,
    WithdrawRequestDto,
} from "./dto/body.dto";
import { ApiError } from "@/common/errors/api_error";
import QueryBuilder from "@/common/utils/queryBuilder";

@Injectable()
export class PaymentService {
    constructor(private prisma: PrismaService) {}

    async getProducerEarningSummary(
        user: UserPayload,
        { type }: EarningSummaryQueryDto,
    ) {
        const deliveredItems = await this.prisma.orderItem.findMany({
            where: {
                status: "Delivered",
                product: {
                    producerId: user.id,
                },
                order: {
                    deliveries: {
                        some: {
                            status: "Delivered",
                        },
                    },
                },
            },
            select: {
                subtotal: true,
                order: {
                    select: {
                        deliveries: {
                            where: {
                                status: "Delivered",
                            },
                            take: 1,
                            select: {
                                updatedAt: true,
                            },
                        },
                    },
                },
            },
        });

        const earnings = deliveredItems
            .map((item) => {
                const deliveredAt = item.order.deliveries[0]?.updatedAt;

                return deliveredAt
                    ? {
                          amount: item.subtotal * 0.9,
                          date: deliveredAt,
                      }
                    : null;
            })
            .filter(
                (earning): earning is { amount: number; date: Date } =>
                    earning !== null,
            );

        if (type === EarningSummaryType.WEEKLY) {
            const dayNames = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
            const currentDate = new Date();
            const currentDay = currentDate.getDay();
            const daysSinceSaturday = (currentDay + 1) % 7;
            const weekStart = new Date(currentDate);
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(currentDate.getDate() - daysSinceSaturday);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);

            const summary = Object.fromEntries(
                dayNames.map((day, index) => {
                    const dayStart = new Date(weekStart);
                    dayStart.setDate(weekStart.getDate() + index);
                    const dayEnd = new Date(dayStart);
                    dayEnd.setDate(dayStart.getDate() + 1);

                    return [
                        day,
                        this.roundEarnings(
                            earnings
                                .filter(
                                    ({ date }) =>
                                        date >= dayStart && date < dayEnd,
                                )
                                .reduce(
                                    (total, { amount }) => total + amount,
                                    0,
                                ),
                        ),
                    ];
                }),
            );

            return {
                message: "Producer weekly earnings fetched successfully",
                data: [summary],
            };
        }

        if (type === EarningSummaryType.MONTHLY) {
            const monthNames = [
                "jan",
                "feb",
                "mar",
                "apr",
                "may",
                "jun",
                "jul",
                "aug",
                "sep",
                "oct",
                "nov",
                "dec",
            ];
            const currentYear = new Date().getFullYear();
            const summary = Object.fromEntries(
                monthNames.map((month, monthIndex) => [
                    month,
                    this.roundEarnings(
                        earnings
                            .filter(({ date }) => {
                                return (
                                    date.getFullYear() === currentYear &&
                                    date.getMonth() === monthIndex
                                );
                            })
                            .reduce((total, { amount }) => total + amount, 0),
                    ),
                ]),
            );

            return {
                message: "Producer monthly earnings fetched successfully",
                data: [summary],
            };
        }

        const yearlySummary = new Map<number, number>();

        for (const { amount, date } of earnings) {
            const year = date.getFullYear();
            yearlySummary.set(year, (yearlySummary.get(year) ?? 0) + amount);
        }

        const summary = Object.fromEntries(
            [...yearlySummary.entries()]
                .sort(([firstYear], [secondYear]) => firstYear - secondYear)
                .map(([year, amount]) => [
                    year.toString(),
                    this.roundEarnings(amount),
                ]),
        );

        return {
            message: "Producer yearly earnings fetched successfully",
            data: [summary],
        };
    }

    async sendWithdrawRequest(user: UserPayload, payload: WithdrawRequestDto) {
        const existingPendingRequest = await this.prisma.withdraw.findFirst({
            where: {
                userId: user.id,
                status: "Pending",
            },
            select: {
                status: true,
            },
        });

        if (existingPendingRequest) {
            throw new ApiError(
                HttpStatus.BAD_REQUEST,
                "You already have a pending withdraw request",
            );
        }

        let currentBalance = null;

        if (user.role === "PRODUCER") {
            const producerProfile =
                await this.prisma.producerProfile.findUnique({
                    where: {
                        userId: user.id,
                    },
                    select: {
                        currentEarnings: true,
                    },
                });
            currentBalance = producerProfile?.currentEarnings ?? null;
        }
        if (user.role === "DRIVER") {
            const driverProfile = await this.prisma.driverProfile.findUnique({
                where: {
                    userId: user.id,
                },
                select: {
                    currentEarnings: true,
                },
            });
            currentBalance = driverProfile?.currentEarnings ?? null;
        }

        if (currentBalance < payload.amount) {
            throw new ApiError(HttpStatus.BAD_REQUEST, "Insufficient balance");
        }

        await this.prisma.withdraw.create({
            data: {
                userId: user.id,
                amount: payload.amount,
            },
        });

        return {
            message: "Withdraw request sent successfully",
        };
    }

    async getUserWithdrawRequests(user: UserPayload, query?: WithdrawQueryDto) {
        const queryBuilder = new QueryBuilder(this.prisma.withdraw, query);

        const response = await queryBuilder
            .filter({
                exacts: ["status"],
            })
            .rawFilter({
                userId: user.id,
            })
            .sortBy({
                createdAt: "desc",
            })
            .paginate()
            .execute();

        const [withdrawRequests, pagination] = await Promise.all([
            response,
            queryBuilder.countTotal(),
        ]);

        return { 
            message: "User withdraw requests fetched successfully",
            data: {
                withdrawRequests,
                meta: pagination,
            },
         };
    }

    private roundEarnings(amount: number) {
        return Number(amount.toFixed(2));
    }
}
