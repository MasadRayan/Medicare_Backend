import { cloudinary } from "../../lib/cloudinary";
import type { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { asyncWrapProviders } from "async_hooks";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      imagePublicId: true,
      imageURL: true,
    },
  });

  const cloudinaryResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
          },

          async (error, result) => {
            if (error) {
              return reject(error);
            }

            if (!result) {
              return reject(new Error("No result returned"));
            }

            resolve(result);
          },
        )
        .end(buffer);
    },
  );

  const updateUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      imageURL: cloudinaryResult.secure_url,
      imagePublicId: cloudinaryResult.public_id,
    },
    omit: {
      password: true,
    },
  });

  if (currentUser?.imagePublicId && currentUser.imageURL) {
    await cloudinary.uploader.destroy(currentUser.imagePublicId);
  }

  return updateUser;
};

export const UserService = {
  uploadProfileImage,
};
