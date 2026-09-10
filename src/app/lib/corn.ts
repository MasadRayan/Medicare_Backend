import cron from "node-cron";
import { prisma } from "./prisma";
import { DoctorverificationStatus, Role } from "../../generated/prisma/enums";

export const deleteUnverifiedDoctors = async () => {
	cron.schedule("*/2 * * * * *", async () => {
		try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const deleteDoctor = await prisma.user.deleteMany({
                where: {
                    role: Role.DOCTOR,
                    emailVerified: false,
                    createdAt: {
                        lt: oneHourAgo
                    },
                    doctor: {
                        verificationStatus: DoctorverificationStatus.PENDING
                    }
                }
            })

            if (deleteDoctor.count > 0) {
                console.log(`Cron: Deleted ${deleteDoctor.count} unverified doctor applications`);
            }

        } catch (error) {
            console.log("Cron: Failed to delete unverified doctor applications", error);
        }
	});

    console.log("Unverified Doctor Delete cron schedule (every 10 minutes)")
};
