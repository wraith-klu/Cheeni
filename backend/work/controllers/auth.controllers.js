import User from "../model/user.model.js";
import bcrypt from "bcryptjs";
import {
  genAccessToken,
  genRefreshToken,
  verifyRefreshToken,
  hashToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../config/token.js";


/**
 * POST /api/auth/signup
 * Creates a new user account, marks it immediately verified (no OTP step),
 * and returns a session token for instant access.
 */
export const signUp = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existUser = await User.findOne({ email: normalizedEmail });

    if (existUser && existUser.isVerified) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    if (existUser && !existUser.isVerified) {
      // Update an existing unverified account with fresh credentials
      existUser.name     = name;
      existUser.password = hashedPassword;
      existUser.isVerified    = true;
      existUser.verificationOtp = null;
      existUser.otpExpiresAt  = null;
      user = await existUser.save();
    } else {
      user = await User.create({
        name,
        email:        normalizedEmail,
        password:     hashedPassword,
        tokenVersion: 0,
        isVerified:   true,   // Direct signup — no email verification needed
      });
    }

    // Issue tokens immediately so the user is logged in right away
    const currentVersion = (user.tokenVersion || 0) + 1;
    user.tokenVersion    = currentVersion;

    const accessToken  = genAccessToken(user._id, currentVersion);
    const refreshToken = genRefreshToken(user._id, currentVersion);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshTokenHash;
    delete sanitizedUser.verificationOtp;

    return res.status(201).json({
      message: "Account created successfully. Welcome to Cheeni AI!",
      accessToken,
      user: sanitizedUser,
    });
  } catch (error) {
    console.error("SignUp error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verifies the 6-digit OTP sent to user's email, activates account (isVerified = true),
 * and generates fresh session tokens.
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "User account not found" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Account is already verified. Please sign in." });
    }

    if (!user.verificationOtp || user.verificationOtp !== otp.trim()) {
      return res.status(400).json({ message: "Invalid verification code. Please check and try again." });
    }

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
    }

    // Activate user and clear OTP fields
    user.isVerified = true;
    user.verificationOtp = null;
    user.otpExpiresAt = null;

    const currentVersion = (user.tokenVersion || 0) + 1;
    user.tokenVersion = currentVersion;

    const accessToken = genAccessToken(user._id, currentVersion);
    const refreshToken = genRefreshToken(user._id, currentVersion);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshTokenHash;
    delete sanitizedUser.verificationOtp;

    return res.status(200).json({
      message: "Email verified successfully! Welcome to Cheeni AI.",
      accessToken,
      user: sanitizedUser,
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({ message: "Internal Server Error during verification" });
  }
};

/**
 * POST /api/auth/resend-otp
 * Resends a fresh 6-digit OTP code to the user's email with a 10-minute expiry.
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "No account found with this email" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Account is already verified" });
    }

    const otp = Math.floor(100000 + crypto.randomInt(900000)).toString();
    user.verificationOtp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendVerificationOtpEmail({
      toEmail: normalizedEmail,
      userName: user.name,
      otp,
    });

    return res.status(200).json({
      message: "A fresh verification code has been dispatched to your email.",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("resendOtp error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /api/auth/signin
 * Authenticates user credentials, verifies account activation,
 * generates short-lived access token in body and httpOnly rotated refresh token in cookie.
 */
export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // If account is still unverified (legacy), auto-verify it on first login attempt
    if (user.isVerified === false) {
      user.isVerified = true;
    }

    // Increment tokenVersion on login for fresh session
    const currentVersion = (user.tokenVersion || 0) + 1;
    user.tokenVersion = currentVersion;

    const accessToken = genAccessToken(user._id, currentVersion);
    const refreshToken = genRefreshToken(user._id, currentVersion);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshTokenHash;
    delete sanitizedUser.verificationOtp;

    return res.status(200).json({
      message: "Logged in successfully",
      accessToken,
      user: sanitizedUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * POST /api/auth/refresh
 * Validates the refresh token from httpOnly cookie against the user's stored hash and tokenVersion.
 * Implements strict rotation: issues a new access token AND rotates the refresh token.
 * Detects token reuse/replay and revokes the session if detected.
 */
export const RefreshToken = async (req, res) => {
  try {
    const oldRefreshToken = req.cookies?.refreshToken;
    if (!oldRefreshToken) {
      return res.status(401).json({
        message: "Refresh token not found",
        error: "refresh_token_not_found",
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(oldRefreshToken);
    } catch (err) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        message: "Invalid or expired refresh token",
        error: "invalid_refresh_token",
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: "User not found", error: "user_not_found" });
    }

    // Verify tokenVersion
    if (decoded.tokenVersion !== user.tokenVersion) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        message: "Refresh token has been revoked",
        error: "revoked_token",
      });
    }

    // Verify hash to detect reuse of previous rotated token
    const incomingHash = hashToken(oldRefreshToken);
    if (user.refreshTokenHash !== incomingHash) {
      // Possible token reuse attack detected: invalidate user session
      user.refreshTokenHash = null;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      clearRefreshTokenCookie(res);
      return res.status(401).json({
        message: "Token reuse detected. All sessions terminated for security.",
        error: "token_reuse_detected",
      });
    }

    // Rotate tokens
    const nextVersion = (user.tokenVersion || 0) + 1;
    user.tokenVersion = nextVersion;

    const newAccessToken = genAccessToken(user._id, nextVersion);
    const newRefreshToken = genRefreshToken(user._id, nextVersion);

    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    setRefreshTokenCookie(res, newRefreshToken);

    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshTokenHash;

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      user: sanitizedUser,
    });
  } catch (error) {
    console.error("RefreshToken error:", error);
    clearRefreshTokenCookie(res);
    return res.status(500).json({ message: "Internal Server Error during token refresh" });
  }
};

/**
 * POST /api/auth/logout
 * Invalidates the current refresh token server-side (clears hash and increments tokenVersion)
 * and clears the httpOnly cookie.
 */
export const Logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        if (decoded?.userId) {
          await User.findByIdAndUpdate(decoded.userId, {
            $set: { refreshTokenHash: null },
            $inc: { tokenVersion: 1 },
          });
        }
      } catch {
        // If expired or invalid, still clear cookie
      }
    }

    clearRefreshTokenCookie(res);
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    clearRefreshTokenCookie(res);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};