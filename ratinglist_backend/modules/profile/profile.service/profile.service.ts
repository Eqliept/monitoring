import { createHash } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";
import { adjectives, nouns, uniqueUsernameGenerator } from "unique-username-generator";

import { AppError, UnauthorizedError } from "../../../errors/appErrors";
import { AccountEntity } from "../../../database/entities/account.entity";
import { UserEntity } from "../../../database/entities/users.entity";
import {
    IProfileUpdatePayload,
    TSecret,
} from "../../auth/auth.service/auth.types";
import {
    hashPasswordValue,
} from "../../auth/security.utils";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";

const accessSecret: TSecret = (process.env.JWT_SECRET ?? "") as TSecret;

if (!accessSecret) {
    throw new Error("Критическая ошибка: JWT секрет не задан в .env");
}

export class ProfileService {
    constructor(private readonly fastify: FastifyInstance) {}

    private getAccountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private getUserRepository() {
        return this.fastify.dataSource.getRepository(UserEntity);
    }

    private async findAccountById(id: string): Promise<AccountEntity | null> {
        return await this.getAccountRepository().findOne({ where: { id } });
    }

    private async findUserById(id: string): Promise<UserEntity | null> {
        return await this.getUserRepository().findOne({ where: { id } });
    }

    private async getAccountFromAccessToken(token?: string): Promise<AccountEntity> {
        if (!token) {
            throw new UnauthorizedError("Access token не предоставлен");
        }

        const decoded = await this.verifyAccessToken(token);
        const subject = decoded.sub as string | undefined;

        if (!subject) {
            throw new UnauthorizedError("Неверный access token (нет sub)");
        }

        const account = await this.findAccountById(subject);

        if (!account) {
            throw new UnauthorizedError("Аккаунт не найден");
        }

        return account;
    }

    private async saveUser(user: UserEntity): Promise<UserEntity> {
        user.updatedAt = new Date();
        return await this.getUserRepository().save(user);
    }

    private async saveAccount(account: AccountEntity): Promise<AccountEntity> {
        account.updatedAt = new Date();
        return await this.getAccountRepository().save(account);
    }

    private hasActiveSecondFactor(account: AccountEntity): boolean {
        return account.twoFactorEnabled && Boolean(account.secondFactorPasswordHash);
    }

    private async verifyAccessToken(token: string): Promise<JwtPayload> {
        try {
            return jwt.verify(token, accessSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedError("Неверный или просроченный access token");
        }
    }

    private serializeProfile(account: AccountEntity, user: UserEntity) {
        return {
            id: user.id,
            email: account.email,
            provider: account.provider,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            telegram: user.telegram,
            avatarUrl: user.avatarUrl,
            twoFactorEnabled: this.hasActiveSecondFactor(account),
            balanceRub: user.balanceRub,
        };
    }

    private async invalidateProfileCaches(account: AccountEntity) {
        await invalidateCacheNamespaces(this.fastify, [
            `profile:${account.id}`,
            `auth:me:${account.id}`,
            `auth:security:${account.id}`,
            `payments:balance:${account.userId}`,
            `messages:user:${account.userId}`,
            "servers:user",
            "servers:list",
            "servers:detail",
            "votes:leaderboard",
        ]);
    }

    async getProfile(token?: string) {
        const account = await this.getAccountFromAccessToken(token);
        return await getCachedJson(this.fastify, `profile:${account.id}`, {}, 60, async () => {
            const user = await this.findUserById(account.userId);

            if (!user) {
                throw new UnauthorizedError("Связанный пользователь не найден");
            }

            return { profile: this.serializeProfile(account, user) };
        });
    }

    async updateProfile(token: string | undefined, payload: IProfileUpdatePayload) {
        const account = await this.getAccountFromAccessToken(token);
        const user = await this.findUserById(account.userId);

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        user.username = payload.username?.trim() || null;
        user.firstName = payload.firstName?.trim() || null;
        user.lastName = payload.lastName?.trim() || null;
        user.telegram = payload.telegram?.trim() || null;

        await this.saveUser(user);
        await this.invalidateProfileCaches(account);

        return { profile: this.serializeProfile(account, user) };
    }

    async uploadAvatar(token: string | undefined, payload: { dataUrl: string }) {
        const account = await this.getAccountFromAccessToken(token);
        const user = await this.findUserById(account.userId);

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        if (!payload.dataUrl?.startsWith("data:image/")) {
            throw new AppError("Нужен корректный image data URL", 400);
        }

        const uploaded = await this.fastify.cloudinary.uploadDataUrl(payload.dataUrl);
        user.avatarUrl = uploaded.secure_url;

        if (!user.username || !user.username.trim()) {
            user.username = uniqueUsernameGenerator({
                dictionaries: [adjectives, nouns],
                separator: "-",
                randomDigits: 0,
                length: 15,
                seed: createHash("sha256").update(payload.dataUrl).digest("hex"),
            });
        }

        await this.saveUser(user);
        await this.invalidateProfileCaches(account);

        return {
            avatarUrl: uploaded.secure_url,
            username: user.username,
        };
    }

    async startTwoFactorSetup(token?: string, password?: string): Promise<{ twoFactorEnabled: boolean }> {
        const account = await this.getAccountFromAccessToken(token);
        const user = await this.findUserById(account.userId);

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        if (!password) {
            throw new AppError("Дополнительный пароль не предоставлен", 400);
        }

        account.twoFactorEnabled = true;
        account.twoFactorEnabledAt = new Date();
        account.secondFactorPasswordHash = hashPasswordValue(password);
        account.twoFactorSecret = null;
        await this.saveAccount(account);
        await this.invalidateProfileCaches(account);

        return { twoFactorEnabled: true };
    }

    async disableTwoFactor(token: string | undefined): Promise<{ twoFactorEnabled: boolean }> {
        const account = await this.getAccountFromAccessToken(token);
        const user = await this.findUserById(account.userId);

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        account.twoFactorEnabled = false;
        account.twoFactorEnabledAt = null;
        account.secondFactorPasswordHash = null;
        account.twoFactorSecret = null;
        await this.saveAccount(account);
        await this.invalidateProfileCaches(account);

        return { twoFactorEnabled: false };
    }
}
