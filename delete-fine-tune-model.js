import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

// Initialize OpenAI with API Key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function listFineTuningJobs() {
    try {
        console.log("Fetching fine-tuning jobs...");
        const jobs = await openai.fineTuning.jobs.list();
        return jobs.data;
    } catch (error) {
        console.error("Error fetching fine-tuning jobs:", error);
    }
}

async function deleteFineTunedModel(modelId) {
    try {
        console.log(`Deleting fine-tuned model: ${modelId}`);
        const response = await fetch(`https://api.openai.com/v1/models/${modelId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
        });

        const responseBody = await response.text(); // Capture raw response

        if (!response.ok) {
            console.error(`Failed to delete model. Status: ${response.status}, Response: ${responseBody}`);
            return;
        }

        console.log(`Model ${modelId} deleted successfully. Response: ${responseBody}`);
    } catch (error) {
        console.error(`Error deleting model ${modelId}:`, error.message);
    }
}


async function cleanOldFineTuningModels() {
    const jobs = await listFineTuningJobs();
    for (const job of jobs) {
        if (job.status === "succeeded" && job.fine_tuned_model) {
            await deleteFineTunedModel(job.id);
        }
    }
}

async function main() {
    // Step 1: Clean old fine-tuned models
    await cleanOldFineTuningModels();

    // Step 2: Start fresh fine-tuning if needed
    console.log("Clean-up complete. Start new fine-tuning as needed.");
}

main();
