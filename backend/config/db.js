import mongoose from 'mongoose';

const connectDb = async () => {
    const primaryUrl = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/CheeniDB";
    try {
        await mongoose.connect(primaryUrl);
        console.log('Connected to the database successfully');
    } catch (error) {
        console.warn(`Primary database connection failed. Attempting fallback to local MongoDB...`);
        try {
            await mongoose.connect("mongodb://127.0.0.1:27017/CheeniDB");
            console.log('Connected to local MongoDB (mongodb://127.0.0.1:27017/CheeniDB) successfully!');
        } catch (fallbackError) {
            console.error('Error connecting to database:', error.message);
        }
    }
}

export default connectDb;