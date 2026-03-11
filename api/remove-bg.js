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

  const API_KEY = process.env.REMOVE_BG_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "REMOVE_BG_API_KEY not configured" });
  }

  try {
    // Convert data URI to binary buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Build multipart form data manually
    const boundary = "----FormBoundary" + Date.now();
    const parts = [];

    // image_file part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image_file"; filename="image.png"\r\n` +
      `Content-Type: image/png\r\n\r\n`
    );
    parts.push(imageBuffer);
    parts.push("\r\n");

    // size part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="size"\r\n\r\n` +
      `full\r\n`
    );

    // format part
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="format"\r\n\r\n` +
      `png\r\n`
    );

    parts.push(`--${boundary}--\r\n`);

    // Combine into a single buffer
    const body = Buffer.concat(
      parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p))
    );

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": API_KEY,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("remove.bg API error:", errorText);
      return res.status(response.status).json({ error: "remove.bg API error", details: errorText });
    }

    // Response is the raw PNG binary
    const resultBuffer = Buffer.from(await response.arrayBuffer());
    const resultBase64 = resultBuffer.toString("base64");
    const resultDataUri = `data:image/png;base64,${resultBase64}`;

    return res.status(200).json({ output: resultDataUri });
  } catch (err) {
    console.error("Error calling remove.bg:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
