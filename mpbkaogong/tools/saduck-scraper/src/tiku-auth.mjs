import fs from "node:fs/promises";
import { SITE_ORIGIN } from "./site-presets.mjs";

export async function readSaduckTokenFromStorageState(storageStatePath) {
  const storageState = JSON.parse(await fs.readFile(storageStatePath, "utf8"));
  const origin = storageState.origins?.find((item) => item.origin === SITE_ORIGIN);
  const token = origin?.localStorage?.find((item) => item.name === "token")?.value;
  if (!token) {
    throw new Error(`No SaDuck token found in ${storageStatePath}`);
  }
  return token;
}
