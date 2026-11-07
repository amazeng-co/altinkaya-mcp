import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** Reads a gzipped HTML fixture recorded from altinkaya.com (logged out). */
export function fixture(name: string): string {
  return gunzipSync(readFileSync(new URL(`fixtures/${name}.html.gz`, import.meta.url))).toString(
    "utf8",
  );
}
