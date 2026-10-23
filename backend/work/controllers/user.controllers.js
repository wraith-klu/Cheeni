import User from "../model/user.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateAssistant = async (req, res) => {
  try {
    const { assistantName, imageUrl, userPreferences } = req.body;

    let assistantImage = null;

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      if (!uploaded) {
        return res.status(500).json({ message: "Failed to upload image to Cloudinary" });
      }
      assistantImage = uploaded;
    } else if (imageUrl) {
      assistantImage = imageUrl;
    }

    const updateFields = {};
    if (assistantName !== undefined) updateFields.assistantName = assistantName;
    if (assistantImage !== null) updateFields.assistantImage = assistantImage;

    // Handle userPreferences update if supplied
    if (userPreferences !== undefined) {
      let parsedPrefs = userPreferences;
      if (typeof userPreferences === "string") {
        try {
          parsedPrefs = JSON.parse(userPreferences);
        } catch {
          // ignore or keep as string
        }
      }

      if (typeof parsedPrefs === "object" && parsedPrefs !== null) {
        if (parsedPrefs.responseStyle) updateFields["userPreferences.responseStyle"] = parsedPrefs.responseStyle;
        if (parsedPrefs.targetGoal !== undefined) updateFields["userPreferences.targetGoal"] = parsedPrefs.targetGoal;
        if (parsedPrefs.customInstructions !== undefined) updateFields["userPreferences.customInstructions"] = parsedPrefs.customInstructions;
        if (Array.isArray(parsedPrefs.programmingLanguages)) updateFields["userPreferences.programmingLanguages"] = parsedPrefs.programmingLanguages;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      updateFields,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Assistant updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating assistant:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
