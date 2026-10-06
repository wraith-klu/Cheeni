import express from "express";
import { getCurrentUser, updateAssistant } from "../controllers/user.controllers.js";
import isAuth from "../middlewares/isAuth.js";
import upload from "../middlewares/multer.js";

const userRouter = express.Router();

userRouter.get("/current", isAuth, getCurrentUser);

const handleUploadMiddleware = (req, res, next) => {
  upload.single("assistantImage")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File size exceeds the 5MB limit. Please upload a smaller image.",
          error: "limit_file_size",
        });
      }
      if (err.code === "INVALID_FILE_TYPE" || err.message?.includes("Only image files are allowed")) {
        return res.status(400).json({
          message: err.message || "Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed.",
          error: "invalid_file_type",
        });
      }
      return res.status(400).json({ message: err.message || "Failed to process image upload." });
    }
    next();
  });
};

userRouter.post(
  "/update",
  isAuth,
  handleUploadMiddleware,
  updateAssistant
);

export default userRouter;
