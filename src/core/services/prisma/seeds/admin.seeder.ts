import { ActivityStatus, PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { ISeeder } from "./seed";

export class AdminSeeder implements ISeeder {
    name = "AdminSeeder";

    async seed(prisma: PrismaClient): Promise<void> {
        const email = process.env.ADMIN_EMAIL || "admin@example.com";
        const rawPassword = process.env.ADMIN_PASSWORD || "123456";

        const existingAdmin = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { role: { in: [UserRole.ADMIN, UserRole.ADMIN] } },
                ],
            },
        });

        if (existingAdmin) {
            console.log(
                `Admin already exists (${existingAdmin.email}. Skipping creation.`,
            );
            return;
        }

        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        const adminUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: UserRole.ADMIN,
                status: ActivityStatus.ACTIVE,              
                deleted: false,
                fullName :"Admin",
                phone: "0000000000",                
            },
           
        });

        console.log(`  ✅ [AdminSeeder] Admin user created successfully!`);
        console.log(`     ├── Email:    ${adminUser.email}`);
        console.log(`     ├── Role:     ${adminUser.role}`);
        console.log(`     └── Password: ${rawPassword}`);
    }
}
