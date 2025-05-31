const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Root route for testing if server is running
app.get("/", (req, res) => {
  res.send("✅ Server is up and running");
});

// ✅ POST route for chatbot
app.post("/chat", async (req, res) => {
  console.log("✅ POST /chat received");

  const userMessage = req.body.message;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant for Overdope Production Hub." },
          { role: "user", content: userMessage }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data.choices[0].message);
  } catch (error) {
    console.error("❌ Error calling OpenAI:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
