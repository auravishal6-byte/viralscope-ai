require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API_KEY;

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

function extractVideoId(input) {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" ||
        host === "music.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0])) return parts[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "ViralScope AI" });
});

app.get("/api/video", async (req, res) => {
  const videoId = extractVideoId(String(req.query.url || ""));
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Valid YouTube video link paste karo." });
  }
  if (!API_KEY) {
    return res.status(503).json({
      error: "Server par YouTube API key set nahi hai. .env file mein YOUTUBE_API_KEY add karo."
    });
  }

  try {
    const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
    endpoint.search = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: videoId,
      key: API_KEY
    }).toString();

    const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
    const payload = await response.json();

    if (!response.ok) {
      const message = payload?.error?.message || "YouTube API request failed.";
      return res.status(response.status).json({ error: message });
    }

    const video = payload.items?.[0];
    if (!video) return res.status(404).json({ error: "Video nahi mila, private hai, ya available nahi hai." });

    // Return YouTube's values as-is. Do not calculate a viral score from API data.
    res.json({
      id: video.id,
      title: video.snippet?.title || "",
      channelTitle: video.snippet?.channelTitle || "",
      publishedAt: video.snippet?.publishedAt || "",
      description: video.snippet?.description || "",
      thumbnail: video.snippet?.thumbnails?.high?.url ||
                 video.snippet?.thumbnails?.medium?.url ||
                 video.snippet?.thumbnails?.default?.url || "",
      duration: video.contentDetails?.duration || "",
      statistics: {
        viewCount: video.statistics?.viewCount ?? null,
        likeCount: video.statistics?.likeCount ?? null,
        commentCount: video.statistics?.commentCount ?? null
      },
      youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`
    });
  } catch (error) {
    console.error("Video lookup failed:", error);
    res.status(502).json({ error: "YouTube se data nahi mil paya. Internet ya API key check karo." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ViralScope AI server running on port ${PORT}`);
});
