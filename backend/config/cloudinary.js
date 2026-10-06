import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const getCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    return cloudinary;
};

const uploadOnCloudinary = async (filePath) => {
    if (!filePath) return null;

    try {
        const client = getCloudinary();
        const uploadResult = await client.uploader.upload(filePath, {
            folder: "cheeni_assistants",
            resource_type: "auto"
        });

        // Safe removal of temp file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return uploadResult.secure_url;
    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        // Clean up temp file on failure as well
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (unlinkErr) {
                console.error("Error cleaning up temp file:", unlinkErr);
            }
        }
        return null;
    }
};

export default uploadOnCloudinary;
