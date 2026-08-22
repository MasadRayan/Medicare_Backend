import { cloudinary } from "../../lib/cloudinary";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
    
  cloudinary.uploader.upload_stream(
    {
      resource_type: "auto",
    },

    (error, result) => {
      if (error) {
        console.log(error.message);
        throw new Error(error.message);
      }
      console.log(result);
    }
  ).end(buffer); 
};

export const UserService = {
  uploadProfileImage,
};
