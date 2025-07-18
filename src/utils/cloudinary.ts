import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "recycling/categories/image",
    allowed_formats: ["jpg", "png", "jpeg"],
  }),
});

const subcategoryStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "recycling/subcategories/image",
    allowed_formats: ["jpg", "png", "jpeg"],
  }),
});

const userStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "recycling/users/avatar",
    allowed_formats: ["jpg", "png", "jpeg"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  }),
});

export { cloudinary, categoryStorage, subcategoryStorage, userStorage };
