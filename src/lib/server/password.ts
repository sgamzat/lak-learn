import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(pbkdf2Callback);

const ITERATIONS = 120_000;
const KEY_LEN = 64;
const DIGEST = "sha512";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST);
  return `${ITERATIONS}:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [iterationsRaw, salt, storedHashHex] = encodedHash.split(":");

  if (!iterationsRaw || !salt || !storedHashHex) {
    return false;
  }

  const iterations = Number(iterationsRaw);

  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const calculatedHash = await pbkdf2(password, salt, iterations, KEY_LEN, DIGEST);
  const storedHash = Buffer.from(storedHashHex, "hex");

  if (calculatedHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(calculatedHash, storedHash);
}

