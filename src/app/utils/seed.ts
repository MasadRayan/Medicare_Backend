import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";
import config from "../config";

export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExists = await prisma.user.findFirst({
      where: {
        role: Role.SUPER_ADMIN,
      },
    });

    if (isSuperAdminExists) {
      console.log("Super Admin Already Exists");
      return;
    }

    const name = config.super_admin_name;
    const email = config.super_admin_email;
    const password = config.super_admin_password;

    if (!name || !email || !password) {
      console.error("Missing required super admin details");
      return;
    }

    const hashedPass = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const superAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPass,
        role: Role.SUPER_ADMIN,
        emailVerified: true,
        needPasswordChange: false,
      },
    });

    console.log("Super Admin Created", superAdmin);
  } catch (error) {
    console.error("Error seeding super admin:", error);
    await prisma.user.delete({
        where: {
            email: config.super_admin_email
        }
    })
  }
};
