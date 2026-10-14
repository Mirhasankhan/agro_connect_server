import { UserPayload } from "@/common/guards/auth.guard";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import {
    EarningSummaryQueryDto,
    EarningSummaryType,
} from "./dto/body.dto";

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
                (
                    earning,
                ): earning is { amount: number; date: Date } =>
                    earning !== null,
            );

        if (type === EarningSummaryType.WEEKLY) {
            const dayNames = [
                "sat",
                "sun",
                "mon",
                "tue",
                "wed",
                "thu",
                "fri",
            ];
            const currentDate = new Date();
            const currentDay = currentDate.getDay();
            const daysSinceSaturday = (currentDay + 1) % 7;
            const weekStart = new Date(currentDate);
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(
                currentDate.getDate() - daysSinceSaturday,
            );
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
                            .reduce(
                                (total, { amount }) => total + amount,
                                0,
                            ),
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
            yearlySummary.set(
                year,
                (yearlySummary.get(year) ?? 0) + amount,
            );
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

    private roundEarnings(amount: number) {
        return Number(amount.toFixed(2));
    }
}
