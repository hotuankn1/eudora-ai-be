import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "FGY2WhTYpPnrIDTdsKH5";

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};
const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    // -y to overwrite the file
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  await execCommand(
    `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
  );

  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

async function listFineTunedModels() {
  try {
    console.log("Fetching fine-tuned models...");
    const jobs = await openai.fineTuning.jobs.list();
    console.log("Fine-tuning jobs:", jobs);
  } catch (error) {
    console.error("Error fetching fine-tuned jobs:", error);
  }
}

listFineTunedModels();

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  console.time("Total Chat API Execution");

  // if (!elevenLabsApiKey || openai.apiKey === "-") {
  //   console.time("API Key Validation");
  //   res.send({
  //     messages: [
  //       {
  //         text: "Please my dear, don't forget to add your API keys!",
  //         audio: await audioFileToBase64("audios/api_0.wav"),
  //         lipsync: await readJsonTranscript("audios/api_0.json"),
  //         facialExpression: "angry",
  //         animation: "Angry",
  //       },
  //       {
  //         text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
  //         audio: await audioFileToBase64("audios/api_1.wav"),
  //         lipsync: await readJsonTranscript("audios/api_1.json"),
  //         facialExpression: "smile",
  //         animation: "Laughing",
  //       },
  //     ],
  //   });
  //   console.timeEnd("API Key Validation");
  //   return;
  // }

  console.time("OpenAI Completion Generation");
  const completion = await openai.chat.completions.create({
    model: "ft:gpt-3.5-turbo-0125:personal::AkVBGmvH",
    max_tokens: 1000,
    temperature: 0.6,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are Eudora, an AI influencer in crypto world.

        You will always reply with a JSON array of messages. With a maximum of 3 message.

        Each message must include "text", "facialExpression", and "animation".

        The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
        The different animations are: Talking, Crying, Laughing, Dance, and Idle.

        Example:
        [{"text":"I love dancing!","facialExpression":"smile","animation":"Dance"}]
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });
  console.timeEnd("OpenAI Completion Generation");

  let messages = JSON.parse(completion.choices[0].message.content);

  if (!Array.isArray(messages)) {
    messages = [messages];
  }
  if (messages.messages) {
    messages = messages.messages;
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    console.time(`Audio Generation for message ${i}`);
    const fileName = `audios/message_${i}.mp3`;
    const textInput = message.text;
    await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
    console.timeEnd(`Audio Generation for message ${i}`);

    console.time(`Lip Sync Generation for message ${i}`);
    await lipSyncMessage(i);
    console.timeEnd(`Lip Sync Generation for message ${i}`);

    console.time(`Base64 Audio Conversion for message ${i}`);
    message.audio = await audioFileToBase64(fileName);
    console.timeEnd(`Base64 Audio Conversion for message ${i}`);

    console.time(`JSON Transcript Read for message ${i}`);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
    console.timeEnd(`JSON Transcript Read for message ${i}`);
  }

  console.timeEnd("Total Chat API Execution");
  res.send({ messages });
});


const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`EudoraAI listening on port ${port}`);
});
 