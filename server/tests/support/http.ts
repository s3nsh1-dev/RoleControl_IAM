import { once } from "node:events";
import type { AddressInfo } from "node:net";
import app from "../../src/app.ts";

type JsonRecord = Record<string, unknown>;

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

type HttpResponse = {
  status: number;
  body: JsonRecord | null;
  headers: Headers;
};

class CookieClient {
  private readonly baseUrl: string;
  private readonly cookies = new Map<string, string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get(path: string, options?: RequestOptions): Promise<HttpResponse> {
    return this.request("GET", path, options);
  }

  async post(path: string, options?: RequestOptions): Promise<HttpResponse> {
    return this.request("POST", path, options);
  }

  async put(path: string, options?: RequestOptions): Promise<HttpResponse> {
    return this.request("PUT", path, options);
  }

  async delete(path: string, options?: RequestOptions): Promise<HttpResponse> {
    return this.request("DELETE", path, options);
  }

  getCookie(name: string) {
    return this.cookies.get(name);
  }

  hasCookie(name: string) {
    return this.cookies.has(name);
  }

  setCookie(name: string, value: string) {
    this.cookies.set(name, value);
  }

  clearCookie(name: string) {
    this.cookies.delete(name);
  }

  private async request(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse> {
    const headers = new Headers(options.headers);
    const cookieHeader = this.serializeCookies();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }

    const requestInit: RequestInit = {
      method,
      headers,
      ...(body !== undefined && { body }),
    };

    const response = await fetch(`${this.baseUrl}${path}`, requestInit);

    this.captureCookies(response);

    const text = await response.text();
    const json = text.length > 0 ? (JSON.parse(text) as JsonRecord) : null;

    return {
      status: response.status,
      body: json,
      headers: response.headers,
    };
  }

  private serializeCookies() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private captureCookies(response: Response) {
    const rawSetCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];

    for (const rawCookie of rawSetCookies) {
      const parts = rawCookie.split(";");
      const [cookiePair, ...attributeParts] = parts;
      if (!cookiePair) {
        continue;
      }
      const separatorIndex = cookiePair.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const name = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();
      const shouldClear =
        value.length === 0 ||
        attributeParts.some((attribute) => {
          const normalizedAttribute = attribute.trim().toLowerCase();
          return normalizedAttribute === "max-age=0";
        });

      if (shouldClear) {
        this.cookies.delete(name);
        continue;
      }

      this.cookies.set(name, value);
    }
  }
}

const startTestServer = async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve the test server address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
};

export { CookieClient, startTestServer };
export type { HttpResponse };
