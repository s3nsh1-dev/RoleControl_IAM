import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import env from "./envHelper.ts";
import { AppError } from "./AppError.ts";

async function compareHashStrings(
  passwordFromUser: string,
  hashFromDatabase: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(passwordFromUser, hashFromDatabase);
  } catch (error) {
    console.log(error);
    throw AppError.badRequest(
      "Something went wrong while comparing hash strings",
    );
  }
}

async function generateHashString(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(env.SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.log(error);
    throw AppError.badRequest("Something went wrong while hashing string");
  }
}

const hashSha256 = (value: string) => {
  return createHash("sha256").update(value).digest("hex");
};

const generateTokenHash = async (token: string) => {
  return await generateHashString(hashSha256(token));
};

const compareTokenHash = async (token: string, hashFromDatabase: string) => {
  return await compareHashStrings(hashSha256(token), hashFromDatabase);
};

export {
  compareHashStrings,
  generateHashString,
  hashSha256,
  generateTokenHash,
  compareTokenHash,
};
