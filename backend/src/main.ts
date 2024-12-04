import express from "express";
import { StreamerInfo, StreamerWands } from "./onlywands.js";
import Twitch, { TwitchStream } from "./twitch.js";

const app = express();
const port = 3000;

const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
  throw new Error("TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET were not set");
}
const twitch = await Twitch.connect(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);

class Streamer {
  sw: StreamerWands;
  stream: TwitchStream;
  avatar?: string;
  lastData?: StreamerInfo;

  constructor(sw: StreamerWands, stream: TwitchStream) {
    this.sw = sw;
    this.stream = stream;

    sw.on("started", () => {
      twitch
        .getUsers(stream.user_login)
        .then((users) => {
          this.avatar = users.data[0].profile_image_url;
        })
        .catch(console.error);
    });
    sw.on("message", (msg) => {
      this.lastData = msg;
    });
  }
}

const streamers = new Map<string, Streamer>();

function handleStream(stream: TwitchStream) {
  console.log("  Checking", stream.user_login, stream.viewer_count);

  const c = new StreamerWands(stream.user_login);
  const s = new Streamer(c, stream);
  streamers.set(stream.user_login, s);
  c.on("closed", () => streamers.delete(stream.user_login));
}

async function checkStreams() {
  try {
    const { data } = await twitch.getStreams();

    console.log(`Got ${data.length} streams`);

    data.forEach(handleStream);
  } catch (e) {
    console.error(e);
  }
}

setInterval(checkStreams, 60 * 1000);
checkStreams();

function getData() {
  return Array.from(streamers.values())
    .filter((s) => !!s.lastData)
    .map((s) => ({
      avatar: s.avatar,
      lastData: s.lastData!,
      ...s.stream,
    }));
}

app.get("/live-directory", async (req, res) => {
  res.json(getData());
});

app.get("/live-directory/sse", async (req, res) => {
  const first = getData();
  if (first.length === 0) {
    res.status(204).end();
    return;
  }

  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Type", "text/event-stream");
  // res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify(first)}\n\n`)
  let updates = setInterval(
    () => res.write(`data: ${JSON.stringify(getData())}\n\n`),
    1000,
  );

  res.on("close", () => {
    clearInterval(updates);
    res.end();
  });
});

app.listen(port);
