import { Router } from "express";
import { upload } from "../../lib/multer";
import { UserController } from "./user.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.patch(
  "/profile-image",
  auth(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
  upload.single("profileImage"),
  UserController.uploadProfileImage,
);

export const userRoutes = router;
