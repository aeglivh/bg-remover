export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Missing "image" field' });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "REPLICATE_API_TOKEN not configured" });
  }

  try {
    // Step 1: Upload image to Replicate's file API so the model gets a proper URL
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const uploadRes = await fetch("https://api.replicate.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error("Replicate upload error:", err);
      return res.status(500).json({ error: "Failed to upload image", details: err });
    }

    const uploadData = await uploadRes.json();
    const imageUrl = uploadData.urls.get;

    // Step 2: Run the background removal model with the uploaded URL
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc",
        input: { image: imageUrl },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Replicate API error:", errorData);
      return res.status(response.status).json({ error: "Replicate API error", details: errorData });
    }

    const prediction = await response.json();

    if (prediction.status === "failed") {
      return res.status(500).json({ error: "Prediction failed", details: prediction.error });
    }

    // prediction.output is a URL to the result PNG
    return res.status(200).json({ output: prediction.output });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
