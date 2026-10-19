import { afterEach, describe, expect, it } from "vitest";
import { cameThroughProxy } from "./auth.server";

const request = (path: string, header?: string) =>
  new Request(`http://localhost${path}`, header === undefined ? {} : { headers: { "x-quicksilver-proxy": header } });

describe("proxy check", () => {
  afterEach(() => {
    delete process.env.QS_PROXY_SECRET;
  });

  it("lets every request through without a secret, as on a laptop", () => {
    expect(cameThroughProxy(request("/"))).toBe(true);
    expect(cameThroughProxy(request("/_serverFn/x", "anything"))).toBe(true);
  });

  it("lets through only requests that carry the secret", () => {
    process.env.QS_PROXY_SECRET = "this-app";
    expect(cameThroughProxy(request("/", "this-app"))).toBe(true);
    expect(cameThroughProxy(request("/"))).toBe(false);
    expect(cameThroughProxy(request("/", "another-app"))).toBe(false);
  });

  it("lets the health check through without the secret", () => {
    process.env.QS_PROXY_SECRET = "this-app";
    expect(cameThroughProxy(request("/api/health"))).toBe(true);
  });
});
