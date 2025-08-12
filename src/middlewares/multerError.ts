import multer from "multer";

export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size allowed is 5MB.",
          error: "FILE_TOO_LARGE"
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected field name. Please check your form field.",
          error: "UNEXPECTED_FIELD"
        });
      default:
        return res.status(400).json({
          success: false,
          message: "File upload error occurred.",
          error: err.code
        });
    }
  }

  // Handle custom fileFilter errors
  if (err.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: "INVALID_FILE_TYPE"
    });
  }

  // Handle other errors
  if (err.message && err.message.includes("files are allowed")) {
    return res.status(400).json({
      success: false,
      message: err.message,
      error: "INVALID_FILE_TYPE"
    });
  }

  next(err);
};