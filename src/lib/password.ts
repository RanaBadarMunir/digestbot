import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;

export function hashPassword(plain: string, cost = BCRYPT_COST): Promise<string> {
  return bcrypt.hash(plain, cost);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | undefined;

/** Compared against when the email is unknown, so response timing doesn't reveal which accounts exist. */
export function dummyHashFor(cost = BCRYPT_COST): Promise<string> {
  dummyHash ??= bcrypt.hash("not-a-real-password", cost);
  return dummyHash;
}
