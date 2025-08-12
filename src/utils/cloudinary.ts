import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";
import multer from "multer";

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
  params: async (req, file) => ({
    folder: `recycling/${req.body.category || "default"}/image`, 
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
const deliveryStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "recycling/users/avatar",
    allowed_formats: ["jpg", "png", "jpeg"], // still useful for Cloudinary's side
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  }),
});

const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Only .jpg, .jpeg, and .png files are allowed"));
  }
  cb(null, true);
};

const deliveryAttachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "recycling/delivery/attachments";

    // Optional: organize by file field name
    if (file.fieldname === "deliveryImage") {
      folder = "recycling/delivery/deliveryImage";
    } else if (file.fieldname === "vehicleImage") {
      folder = "recycling/delivery/vehicleImage";
    } else if (file.fieldname === "criminalRecord") {
      folder = "recycling/delivery/criminalRecord";
    }

    return {
      folder,
      allowed_formats: ["jpg", "png", "jpeg", "pdf"],
      public_id: `${Date.now()}-${file.originalname.split(".")[0]}`, // optional unique name
    };
  },
});

export {
  cloudinary,
  categoryStorage,
  subcategoryStorage,
  userStorage,
  deliveryAttachmentStorage,
  deliveryStorage,
  fileFilter
};
