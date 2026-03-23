import crypto from "node:crypto";

const HASH_ENCODING = "hex";
const HASH_KEYLEN = 64;
const HASH_ALGO = "sha512";

export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString(HASH_ENCODING);

  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, HASH_KEYLEN, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key.toString(HASH_ENCODING));
    });
  });

  return `scrypt$${salt}$${derived}`;
};

export const verifyPassword = async (password, storedHash = "") => {
  const [scheme, salt, digest] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;

  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, HASH_KEYLEN, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });

  const digestBuffer = Buffer.from(digest, HASH_ENCODING);
  return (
    digestBuffer.length === derived.length && crypto.timingSafeEqual(digestBuffer, Buffer.from(derived))
  );
};

export const generatePassword = (length = 12) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  return Array.from(crypto.randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join("");
};

export const generateToken = () => crypto.randomBytes(32).toString(HASH_ENCODING);
