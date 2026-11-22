type CloudProperty = {
  id: string;
  name: string;
  value: unknown;
  value_updated_at?: string;
};

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

const TOKEN_URL = "https://api2.arduino.cc/iot/v1/clients/token";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum dikonfigurasi`);
  return value;
}

async function getAccessToken(): Promise<string> {
  const bufferMs = 5 * 60 * 1000;
  if (tokenCache && tokenCache.expiresAt - Date.now() > bufferMs) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: requiredEnv("ARDUINO_CLIENT_ID"),
    client_secret: requiredEnv("ARDUINO_CLIENT_SECRET"),
    audience: "https://api2.arduino.cc/iot",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Arduino Cloud OAuth gagal (${response.status}): ${text.slice(0, 180)}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  if (!data.access_token)
    throw new Error("Arduino Cloud tidak mengembalikan access token");

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return data.access_token;
}

async function cloudFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const response = await fetch(`https://api2.arduino.cc/iot/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (response.status === 401) tokenCache = null;
  return response;
}

export async function getThingProperties(): Promise<
  Record<string, CloudProperty>
> {
  const thingId = requiredEnv("ARDUINO_THING_ID");
  const response = await cloudFetch(`/things/${thingId}/properties`);
  if (!response.ok) {
    throw new Error(
      `Gagal mengambil property Arduino Cloud (${response.status})`,
    );
  }

  const properties = (await response.json()) as CloudProperty[];
  const wanted = new Set([
    "suhu",
    "kelembapan",
    "pompaStatus",
    "modeAuto",
    "batasBawahRH",
  ]);
  return Object.fromEntries(
    properties
      .filter((property) => wanted.has(property.name))
      .map((property) => [property.name, property]),
  ) as Record<string, CloudProperty>;
}

export async function publishProperty(
  name: "pompaStatus" | "modeAuto" | "batasBawahRH",
  value: boolean | number,
): Promise<void> {
  const properties = await getThingProperties();
  const property = properties[name];
  if (!property?.id)
    throw new Error(
      `Property ${name} tidak ditemukan pada Thing Arduino Cloud`,
    );

  const response = await cloudFetch(`/properties/${property.id}/publish`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
  if (!response.ok) {
    throw new Error(`Gagal mempublikasikan ${name} (${response.status})`);
  }
}
