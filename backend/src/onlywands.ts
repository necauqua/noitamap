import EventEmitter from "events";
import WebSocket from "ws";
import { z, ZodIssueCode } from "zod";

const StreamerInfo = z.object({
  x: z.number(),
  y: z.number(),
});
export type StreamerInfo = z.infer<typeof StreamerInfo>;

// why is this not in zod
const parseJsonString = (value: any, ctx: z.RefinementCtx) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (e) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: (e as Error).message,
      });
    }
  }
  return value;
};

const StreamerWandsMessage = z.preprocess(
  parseJsonString,
  z.object({
    info: z.tuple([StreamerInfo]),
  }),
);

type Events = {
  started: [];
  message: [StreamerInfo];
  closed: [];
};

export class StreamerWands extends EventEmitter<Events> {
  ws: WebSocket;
  started: boolean;
  alive: boolean;
  check: NodeJS.Timeout;

  constructor(streamer_login: string) {
    super();
    this.ws = new WebSocket(`wss://onlywands.com/client=${streamer_login}`);
    this.started = false;
    this.alive = false;
    this.check = setInterval(() => {
      if (this.alive) {
        return;
      }
      this.alive = false;
      console.log("No data, closing -", streamer_login);
      this.close();
    }, 10000);

    this.ws.onmessage = (event) => {
      if (event.data == "sup nerd") {
        return;
      }
      if (event.data == "ping") {
        this.ws.send("pong");
        return;
      }
      if (!this.started) {
        this.emit("started");
        this.started = true;
      }
      this.alive = true;
      const data = StreamerWandsMessage.safeParse(event.data);
      if (data.success) {
        this.emit("message", data.data.info[0]);
      } else {
        console.error(data.error);
      }
    };
    this.ws.onerror = (e) => {
      console.error(e);
      this.close();
    };
    this.ws.onclose = () => this.close();
  }

  close() {
    this.ws.close();
    clearInterval(this.check);
    this.emit("closed");
  }
}
