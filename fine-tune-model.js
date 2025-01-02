import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

// Initialize OpenAI with API Key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Upload the training dataset
async function uploadDataset() {
  try {
    console.log("Uploading dataset...");
    const file = await openai.files.create({
      file: fs.createReadStream("fine-tune-data/whitepaper.jsonl"),
      purpose: "fine-tune",
    });
    console.log("Dataset uploaded:", file);
    return file.id; // Return the file ID for fine-tuning
  } catch (error) {
    console.error("Error uploading dataset:", error);
  }
}

// Start the fine-tuning job
async function startFineTuning(fileId) {
  try {
    console.log("Starting fine-tuning...");
    const fineTune = await openai.fineTuning.jobs.create({
      training_file: fileId,
      model: "gpt-3.5-turbo", // Supported fine-tune model; adjust as needed
    });
    console.log("Fine-tuning started:", fineTune);
  } catch (error) {
    console.error("Error starting fine-tuning:", error);
  }
}

// Main function to fine-tune
async function fineTuneModel() {
  try {
    const fileId = await uploadDataset(); // Upload and get file ID
    if (fileId) {
      await startFineTuning(fileId); // Start fine-tuning
    }
  } catch (error) {
    console.error("Error during fine-tuning process:", error);
  }
}

fineTuneModel();
