import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import User from "../model/user.model.js";
import Conversation from "../model/conversation.model.js";

/**
 * Migration Script: Migrate embedded user.history messages into the separate Conversation collection.
 *
 * SAFETY INSTRUCTIONS:
 * - Before running on production, run against a staging/test MongoDB URI by setting MONGO_URI/MONGODB_URL in .env.
 * - This script is IDEMPOTENT: it verifies whether messages already exist for each user before insertion.
 * - Does NOT mutate or delete the legacy user.history array to prevent any data loss during verification.
 */
async function runMigration() {
  const mongoUri = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/CheeniDB";
  console.log("============================================================");
  console.log(" Cheeni Conversation History Migration");
  console.log(` Target DB: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")}`);
  console.log("============================================================\n");

  await mongoose.connect(mongoUri);
  console.log(" Connected to MongoDB successfully.\n");

  try {
    // Retrieve all users that have embedded history messages
    const allUsers = await User.find({}).lean();
    const usersWithHistory = allUsers.filter(u => Array.isArray(u.history) && u.history.length > 0);

    const totalUsersWithHistory = usersWithHistory.length;
    let totalEmbeddedMessages = 0;
    for (const u of usersWithHistory) {
      totalEmbeddedMessages += (u.history || []).length;
    }

    console.log(` Found ${totalUsersWithHistory} user(s) with embedded chat history.`);
    console.log(` Total embedded messages to migrate: ${totalEmbeddedMessages}\n`);

    if (totalUsersWithHistory === 0) {
      console.log(" No users found with history to migrate. Exiting.");
      await mongoose.disconnect();
      return;
    }

    let processedUsers = 0;
    let migratedMessagesCount = 0;
    let skippedUsersCount = 0;
    const errors = [];

    const BATCH_SIZE = 500;
    let currentBatch = [];

    for (const user of usersWithHistory) {
      processedUsers++;
      const userId = user._id;
      const history = user.history || [];

      // Idempotency check: see if messages already exist in Conversation for this user
      const existingCount = await Conversation.countDocuments({ userId });
      if (existingCount > 0) {
        console.log(`[User ${processedUsers}/${totalUsersWithHistory}] User ${userId} already has ${existingCount} Conversation document(s). Skipping to avoid duplicate records.`);
        skippedUsersCount++;
        continue;
      }

      for (const msg of history) {
        if (!msg || !msg.content || typeof msg.content !== "string" || !msg.content.trim()) {
          continue;
        }

        currentBatch.push({
          userId: userId,
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content.trim(),
          speechText: msg.speechText || null,
          action: msg.action || null,
          timestamp: msg.timestamp || new Date(),
        });

        if (currentBatch.length >= BATCH_SIZE) {
          try {
            await Conversation.insertMany(currentBatch, { ordered: false });
            migratedMessagesCount += currentBatch.length;
            currentBatch = [];
          } catch (batchErr) {
            console.error(` Error inserting batch:`, batchErr.message);
            errors.push({ userId, error: batchErr.message });
          }
        }
      }

      console.log(`[User ${processedUsers}/${totalUsersWithHistory}] Prepared ${history.length} message(s) for user ${userId} (${user.email || user.name})`);
    }

    // Insert any remaining in the final batch
    if (currentBatch.length > 0) {
      try {
        await Conversation.insertMany(currentBatch, { ordered: false });
        migratedMessagesCount += currentBatch.length;
        currentBatch = [];
      } catch (batchErr) {
        console.error(` Error inserting final batch:`, batchErr.message);
        errors.push({ batch: "final", error: batchErr.message });
      }
    }

    // Post-migration Count Verification Check
    const totalInCollection = await Conversation.countDocuments();

    console.log("\n============================================================");
    console.log(" Migration Summary & Verification Report");
    console.log("============================================================");
    console.log(` Users with history found       : ${totalUsersWithHistory}`);
    console.log(` Users processed                : ${processedUsers}`);
    console.log(` Users skipped (already exists) : ${skippedUsersCount}`);
    console.log(` Total embedded messages before : ${totalEmbeddedMessages}`);
    console.log(` Total messages migrated        : ${migratedMessagesCount}`);
    console.log(` Total documents in Conversation: ${totalInCollection}`);
    console.log(` Errors encountered             : ${errors.length}`);
    console.log("============================================================\n");

    if (errors.length > 0) {
      console.warn("⚠️ Some errors occurred during migration:");
      console.warn(JSON.stringify(errors, null, 2));
    } else {
      console.log("✅ Migration completed cleanly with 0 errors.");
    }
  } catch (err) {
    console.error("Migration failed with fatal exception:", err);
  } finally {
    await mongoose.disconnect();
    console.log(" Disconnected from MongoDB.");
  }
}

// Allow CLI execution
runMigration();
