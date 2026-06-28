import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ISSUER = "Astronix Monitoring";
const PASSWORD_HASH_ALGORITHM = "pbkdf2";
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_HASH_DIGEST = "sha256";

function normalizeBase32(value: string): string {
    return value.replace(/=+/g, "").replace(/[^A-Z2-7]/gi, "").toUpperCase();
}

export function base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = "";

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

export function base32Decode(input: string): Buffer {
    const normalized = normalizeBase32(input);
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const char of normalized) {
        const index = BASE32_ALPHABET.indexOf(char);

        if (index === -1) {
            continue;
        }

        value = (value << 5) | index;
        bits += 5;

        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Buffer.from(output);
}

export function generateTotpSecret(): string {
    return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUri(accountName: string, secret: string): string {
    const issuer = encodeURIComponent(TOTP_ISSUER);
    const label = encodeURIComponent(`${TOTP_ISSUER}:${accountName}`);

    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

function generateHotp(secret: string, counter: number, digits = TOTP_DIGITS): string {
    const key = base32Decode(secret);
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const otp = binary % 10 ** digits;

    return otp.toString().padStart(digits, "0");
}

export function generateTotpCode(secret: string, timestamp = Date.now()): string {
    const counter = Math.floor(timestamp / 1000 / TOTP_STEP_SECONDS);
    return generateHotp(secret, counter);
}

export function verifyTotpCode(
    secret: string,
    code: string,
    options: { window?: number; timestamp?: number } = {},
): boolean {
    const normalizedCode = code.replace(/\D/g, "");

    if (normalizedCode.length !== TOTP_DIGITS) {
        return false;
    }

    const window = options.window ?? 1;
    const timestamp = options.timestamp ?? Date.now();
    const baseCounter = Math.floor(timestamp / 1000 / TOTP_STEP_SECONDS);

    for (let offset = -window; offset <= window; offset += 1) {
        if (generateHotp(secret, baseCounter + offset) === normalizedCode) {
            return true;
        }
    }

    return false;
}

export function hashPasswordValue(value: string): string {
    const salt = crypto.randomBytes(16).toString("base64url");
    const hash = crypto
        .pbkdf2Sync(value, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, PASSWORD_HASH_DIGEST)
        .toString("base64url");

    return [PASSWORD_HASH_ALGORITHM, PASSWORD_HASH_ITERATIONS, salt, hash].join("$");
}

export function verifyPasswordValue(value: string, storedHash: string): boolean {
    const [algorithm, iterationsValue, salt, hash] = storedHash.split("$");

    if (algorithm !== PASSWORD_HASH_ALGORITHM || !iterationsValue || !salt || !hash) {
        return false;
    }

    const iterations = Number(iterationsValue);

    if (!Number.isFinite(iterations) || iterations <= 0) {
        return false;
    }

    const expected = crypto
        .pbkdf2Sync(value, salt, iterations, PASSWORD_HASH_KEY_LENGTH, PASSWORD_HASH_DIGEST)
        .toString("base64url");

    const actualBuffer = Buffer.from(hash, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getEncryptionKey(): Buffer {
    const secret =
        process.env.TWO_FACTOR_ENCRYPTION_SECRET ??
        process.env.JWT_SECRET ??
        process.env.JWT_REFRESH_SECRET ??
        "astronix-two-factor-secret";

    return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptText(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split(".");

    if (!ivValue || !tagValue || !encryptedValue) {
        throw new Error("Неверный формат зашифрованного значения");
    }

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        getEncryptionKey(),
        Buffer.from(ivValue, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}
