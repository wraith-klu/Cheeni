import express from "express";
import {
  signUp,
  verifyOtp,
  resendOtp,
  Login,
  RefreshToken,
  Logout,
} from "../controllers/auth.controllers.js";
import { authLimiter } from "../middlewares/rateLimiter.js";

const authRouter = express.Router();

authRouter.post("/signup", authLimiter, signUp);
authRouter.post("/verify-otp", authLimiter, verifyOtp);
authRouter.post("/resend-otp", authLimiter, resendOtp);
authRouter.post("/signin", authLimiter, Login);
authRouter.post("/refresh", RefreshToken);
authRouter.post("/logout", Logout);

export default authRouter;