import z, { ZodType } from "zod";

// have zod just for pretty errors in rare cases twitch responds with garbage?.
const TwitchAuth = z.object({ access_token: z.string() });

async function twtichAuth(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  return fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" },
  )
    .then((res) => res.json())
    .then(TwitchAuth.parse)
    .then((data) => data.access_token);
}

// interface types dont expand like type types do
interface Paginated<T> {
  data: T[];
  pagination?: { cursor: string };
}

function paginated<T>(data: ZodType<T>): ZodType<Paginated<T>> {
  return z.object({
    data: z.array(data),
    pagination: z.object({ cursor: z.string() }).optional(),
  });
}

const TwitchStream = z.object({
  user_login: z.string(), // streamer wands and also twitch avatar
  title: z.string(),
  user_name: z.string(),
  viewer_count: z.number(),
});
export interface TwitchStream extends z.infer<typeof TwitchStream> {}

const TwitchStreams = paginated<TwitchStream>(TwitchStream);
export type TwitchStreams = z.infer<typeof TwitchStreams>;

async function getStreams(
  clientId: string,
  token: string,
): Promise<TwitchStreams> {
  return fetch("https://api.twitch.tv/helix/streams?type=live&game_id=505705", {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
  })
    .then((res) => res.json())
    .then(TwitchStreams.parse);
}

const TwitchUser = z.object({
  profile_image_url: z.string(),
});
export interface TwitchUser extends z.infer<typeof TwitchUser> {}

const TwitchUsers = paginated<TwitchUser>(TwitchUser);
export type TwitchUsers = z.infer<typeof TwitchUsers>;

async function getUsers(
  clientId: string,
  token: string,
  ...logins: string[]
): Promise<TwitchUsers> {
  return fetch(
    `https://api.twitch.tv/helix/users?login=${logins.join("&login=")}`,
    {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
      },
    },
  )
    .then((res) => res.json())
    .then(TwitchUsers.parse);
}

export default class Twitch {
  private token: string;
  private clientId: string;

  private constructor(clientId: string, token: string) {
    this.clientId = clientId;
    this.token = token;
  }

  static async connect(
    clientId: string,
    clientSecret: string,
  ): Promise<Twitch> {
    const token = await twtichAuth(clientId, clientSecret);
    return new Twitch(clientId, token);
  }

  async getStreams(): Promise<TwitchStreams> {
    return getStreams(this.clientId, this.token);
  }

  async getUsers(...logins: string[]): Promise<TwitchUsers> {
    return getUsers(this.clientId, this.token, ...logins);
  }
}
