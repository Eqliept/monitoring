import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import jwt, { JwtPayload } from "jsonwebtoken";
import { adjectives, nouns, uniqueUsernameGenerator } from "unique-username-generator";

import { AppError, UnauthorizedError } from "../../../errors/appErrors";
import { AccountEntity, EAccountProvider } from "../../../database/entities/account.entity";
import { UserEntity } from "../../../database/entities/users.entity";
import {
    IAuthResult,
    IMagicLinkPayload,
    IOAuthProfile,
    IOAuthStatePayload,
    IPayload,
    IRefreshRequest,
    IVerifyTwoFactorRequest,
    OAuthProvider,
    TExpiration,
    TSecret,
} from "./auth.types";
import {
    hashPasswordValue,
    normalizeEmail,
    verifyPasswordValue,
} from "../security.utils";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";

const accessSecret: TSecret = (process.env.JWT_SECRET ?? "") as TSecret;
const refreshSecret: TSecret = (process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? "") as TSecret;
const accessExpiration: TExpiration = process.env.JWT_ACCESS_EXPIRATION ?? "15m";
const refreshExpiration: TExpiration = process.env.JWT_REFRESH_EXPIRATION ?? "7d";

const backendOrigin = process.env.BACKEND_URL ?? "http://localhost:3000";
const frontendOrigin = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3001";

const OAUTH_STATE_TTL_SECONDS = 600;
const MAGIC_LINK_TTL_SECONDS = 600;
const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 600;
const EMAIL_CHANGE_TTL_SECONDS = 900;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

type OAuthProviderConfig = {
    clientId: string;
    clientSecret: string;
    authorizeUrl: string;
    tokenUrl: string;
    profileUrl: string;
    scopes: string[];
    redirectUri: string;
};

if (!accessSecret || !refreshSecret) {
    throw new Error("Критическая ошибка: JWT секреты не заданы в .env");
}

type SerializedAccount = {
    id: string;
    email: string;
    provider: EAccountProvider;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    telegram: string | null;
    avatarUrl: string | null;
    twoFactorEnabled: boolean;
};

type SerializedUser = Omit<SerializedAccount, "email" | "provider"> & {
    email: string;
    provider: EAccountProvider;
};

type MagicConsumeResult = {
    session?: IAuthResult;
    redirectTo: string;
    twoFactorChallenge?: string;
    email?: string;
};

export class AuthService {
    private readonly fastify: FastifyInstance;

    constructor(fastify: FastifyInstance) {
        this.fastify = fastify;
    }

    private get providerConfig(): Record<OAuthProvider, OAuthProviderConfig> {
        return {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID ?? "",
                clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
                authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
                tokenUrl: "https://oauth2.googleapis.com/token",
                profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
                scopes: ["openid", "email", "profile"],
                redirectUri: `${backendOrigin}/api/auth/oauth/google/callback`,
            },
            discord: {
                clientId: process.env.DISCORD_CLIENT_ID ?? "",
                clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
                authorizeUrl: "https://discord.com/api/oauth2/authorize",
                tokenUrl: "https://discord.com/api/oauth2/token",
                profileUrl: "https://discord.com/api/users/@me",
                scopes: ["identify", "email"],
                redirectUri: `${backendOrigin}/api/auth/oauth/discord/callback`,
            },
        };
    }

    private getProvider(provider: OAuthProvider): OAuthProviderConfig {
        const config = this.providerConfig[provider];

        if (!config.clientId || !config.clientSecret) {
            throw new AppError(`OAuth provider ${provider} is not configured`, 500);
        }

        return config;
    }

    private normalizeRedirectTo(redirectTo?: string): string {
        try {
            const url = new URL(redirectTo ?? "/", frontendOrigin);
            const frontendUrl = new URL(frontendOrigin);

            if (url.origin !== frontendUrl.origin) {
                return frontendUrl.toString();
            }

            return url.toString();
        } catch {
            return new URL(frontendOrigin).toString();
        }
    }

    private buildMagicLink(token: string, redirectTo: string): string {
        const url = new URL(`${backendOrigin}/api/auth/magic/consume`);
        url.searchParams.set("token", token);
        url.searchParams.set("redirectTo", redirectTo);
        return url.toString();
    }

    private buildFrontendAuthUrl(params: { challenge?: string; redirectTo?: string; email?: string; error?: string }): string {
        const url = new URL("/auth", frontendOrigin);

        if (params.challenge) {
            url.searchParams.set("challenge", params.challenge);
        }

        if (params.redirectTo) {
            url.searchParams.set("redirectTo", params.redirectTo);
        }

        if (params.email) {
            url.searchParams.set("email", params.email);
        }

        if (params.error) {
            url.searchParams.set("error", params.error);
        }

        return url.toString();
    }

    private getAccountRepository() {
        return this.fastify.dataSource.getRepository(AccountEntity);
    }

    private getUserRepository() {
        return this.fastify.dataSource.getRepository(UserEntity);
    }

    private async findAccountById(id: string): Promise<AccountEntity | null> {
        const repo = this.getAccountRepository();
        return await repo.findOne({ where: { id } });
    }

    private async findUserById(id: string): Promise<UserEntity | null> {
        const repo = this.getUserRepository();
        return await repo.findOne({ where: { id } });
    }

    private displayName(user: UserEntity): string {
        const directName = user.username?.trim();
        const composedName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        return directName || composedName || "Пользователь";
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

    private async saveAccount(account: AccountEntity): Promise<AccountEntity> {
        account.updatedAt = new Date();
        const saved = await this.getAccountRepository().save(account);
        await invalidateCacheNamespaces(this.fastify, [
            `auth:me:${account.id}`,
            `auth:security:${account.id}`,
            `profile:${account.id}`,
        ]);
        return saved;
    }

    private async saveUser(user: UserEntity): Promise<UserEntity> {
        user.updatedAt = new Date();
        return await this.getUserRepository().save(user);
    }

    private hasActiveSecondFactor(account: AccountEntity): boolean {
        return account.twoFactorEnabled && Boolean(account.secondFactorPasswordHash);
    }

    private async getOrCreateAccount(email: string, provider: EAccountProvider): Promise<{ account: AccountEntity; user: UserEntity }> {
        const normalizedEmail = normalizeEmail(email);
        const repo = this.getAccountRepository();
        const existing = await repo.findOne({ where: { email: normalizedEmail } });

        if (existing) {
            const user = await this.findUserById(existing.userId);

            if (!user) {
                throw new UnauthorizedError("Связанный пользователь не найден");
            }

            if (existing.provider !== provider && existing.provider !== EAccountProvider.Email) {
                existing.provider = provider;
                await this.saveAccount(existing);
            }

            return { account: existing, user };
        }

        const userRepo = this.getUserRepository();
        const user = await userRepo.save(
            userRepo.create({
                id: randomUUID(),
                username: uniqueUsernameGenerator({
                    dictionaries: [adjectives, nouns],
                    separator: "-",
                    randomDigits: 0,
                    length: 15,
                    seed: randomUUID(),
                }),
                firstName: null,
                lastName: null,
                telegram: null,
                avatarUrl: null,
            }),
        );

        const account = await repo.save(
            repo.create({
                id: randomUUID(),
                userId: user.id,
                email: normalizedEmail,
                provider,
                twoFactorEnabled: false,
                secondFactorPasswordHash: null,
                twoFactorSecret: null,
                twoFactorEnabledAt: null,
            }),
        );

        return { account, user };
    }

    private async createSession(account: AccountEntity, user: UserEntity): Promise<IAuthResult> {
        const payload: IPayload = { sub: account.id, email: account.email } as IPayload;
        const accessOptions: jwt.SignOptions = { expiresIn: accessExpiration as jwt.SignOptions["expiresIn"] };
        const refreshOptions: jwt.SignOptions = { expiresIn: refreshExpiration as jwt.SignOptions["expiresIn"] };

        const token = jwt.sign(payload, accessSecret, accessOptions);
        const refreshToken = jwt.sign(payload, refreshSecret, refreshOptions);

        await this.fastify.redis.set(`auth:refresh:${account.id}`, refreshToken, {
            EX: REFRESH_TOKEN_TTL_SECONDS,
        });

        return {
            token,
            refreshToken,
            user: {
                id: user.id,
                email: account.email,
                provider: account.provider,
                name: this.displayName(user),
                avatarUrl: user.avatarUrl,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                telegram: user.telegram,
                twoFactorEnabled: this.hasActiveSecondFactor(account),
                balanceRub: user.balanceRub,
            },
        };
    }

    private async verifyAccessToken(token: string): Promise<JwtPayload> {
        try {
            return jwt.verify(token, accessSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedError("Неверный или просроченный access token");
        }
    }

    private async verifyRefreshToken(token: string): Promise<JwtPayload> {
        try {
            return jwt.verify(token, refreshSecret) as JwtPayload;
        } catch {
            throw new UnauthorizedError("Неверный или просроченный refresh token");
        }
    }

    async requestMagicLink(email: string, redirectTo?: string): Promise<{ success: boolean }> {
        const normalizedEmail = normalizeEmail(email);
        const normalizedRedirectTo = this.normalizeRedirectTo(redirectTo);
        const token = randomUUID();
        const payload: IMagicLinkPayload = {
            email: normalizedEmail,
            redirectTo: normalizedRedirectTo,
        };

        await this.fastify.redis.set(`auth:magic:${token}`, JSON.stringify(payload), {
            EX: MAGIC_LINK_TTL_SECONDS,
        });

        const magicLink = this.buildMagicLink(token, normalizedRedirectTo);
        console.log(`[auth] magic link for ${normalizedEmail}: ${magicLink}`);

        return { success: true };
    }

    async consumeMagicLink(token: string): Promise<MagicConsumeResult> {
        if (!token) {
            throw new AppError("Magic link token не предоставлен", 400);
        }

        const storedPayload = await this.fastify.redis.get(`auth:magic:${token}`);

        if (!storedPayload) {
            throw new UnauthorizedError("Ссылка для входа недействительна или устарела");
        }

        const payload = JSON.parse(storedPayload) as IMagicLinkPayload;
        const { account, user } = await this.getOrCreateAccount(payload.email, EAccountProvider.Email);

        await this.fastify.redis.del(`auth:magic:${token}`);

        if (this.hasActiveSecondFactor(account)) {
            const challenge = randomUUID();
            await this.fastify.redis.set(
                `auth:2fa:challenge:${challenge}`,
                JSON.stringify({
                    accountId: account.id,
                    redirectTo: payload.redirectTo,
                }),
                { EX: TWO_FACTOR_CHALLENGE_TTL_SECONDS },
            );

            return {
                redirectTo: this.buildFrontendAuthUrl({
                    challenge,
                    redirectTo: payload.redirectTo,
                    email: account.email,
                }),
                twoFactorChallenge: challenge,
                email: account.email,
            };
        }

        return {
            session: await this.createSession(account, user),
            redirectTo: payload.redirectTo,
        };
    }

    async verifyTwoFactorChallenge({ challenge, password }: IVerifyTwoFactorRequest): Promise<{ session: IAuthResult; redirectTo: string }> {
        if (!challenge || !password) {
            throw new AppError("Для второго фактора требуется challenge и password", 400);
        }

        const storedChallenge = await this.fastify.redis.get(`auth:2fa:challenge:${challenge}`);

        if (!storedChallenge) {
            throw new UnauthorizedError("Челлендж дополнительного пароля недействителен или истек");
        }

        const parsedChallenge = JSON.parse(storedChallenge) as { accountId: string; redirectTo: string };
        const account = await this.findAccountById(parsedChallenge.accountId);

        if (!account) {
            throw new UnauthorizedError("Аккаунт не найден");
        }

        const user = await this.findUserById(account.userId);

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        if (!account.secondFactorPasswordHash) {
            throw new AppError("Дополнительный пароль не настроен", 400);
        }

        if (!verifyPasswordValue(password, account.secondFactorPasswordHash)) {
            throw new UnauthorizedError("Неверный дополнительный пароль");
        }

        await this.fastify.redis.del(`auth:2fa:challenge:${challenge}`);

        return {
            session: await this.createSession(account, user),
            redirectTo: parsedChallenge.redirectTo,
        };
    }

    async refresh({ token }: IRefreshRequest): Promise<IAuthResult> {
        if (!token) {
            throw new UnauthorizedError("Refresh token не предоставлен");
        }

        const decoded = await this.verifyRefreshToken(token);
        const subject = decoded.sub as string | undefined;

        if (!subject) {
            throw new UnauthorizedError("Неверный refresh token (нет sub)");
        }

        const storedRefreshToken = await this.fastify.redis.get(`auth:refresh:${subject}`);

        if (!storedRefreshToken || storedRefreshToken !== token) {
            throw new UnauthorizedError("Refresh токен недействителен или был отозван");
        }

        const account = await this.findAccountById(subject);

        if (!account) {
            throw new UnauthorizedError("Аккаунт не найден");
        }

        const user = await this.findUserById(account.userId);

        if (!user) {
            throw new UnauthorizedError("Связанный пользователь не найден");
        }

        return await this.createSession(account, user);
    }

    async me(token?: string): Promise<{ user: IAuthResult["user"] }> {
        const account = await this.getAccountFromAccessToken(token);
        return await getCachedJson(this.fastify, `auth:me:${account.id}`, {}, 60, async () => {
            const user = await this.findUserById(account.userId);

            if (!user) {
                throw new UnauthorizedError("Связанный пользователь не найден");
            }

            return {
                user: {
                    id: user.id,
                    email: account.email,
                    provider: account.provider,
                    name: this.displayName(user),
                    avatarUrl: user.avatarUrl,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    telegram: user.telegram,
                    twoFactorEnabled: this.hasActiveSecondFactor(account),
                    balanceRub: user.balanceRub,
                },
            };
        });
    }

    async logout({ token }: IRefreshRequest): Promise<{ success: boolean }> {
        if (!token) {
            throw new UnauthorizedError("Refresh token не предоставлен");
        }

        const decoded = await this.verifyRefreshToken(token);
        const subject = decoded.sub as string | undefined;

        if (!subject) {
            throw new UnauthorizedError("Неверный refresh token (нет sub)");
        }

        await this.fastify.redis.del(`auth:refresh:${subject}`);

        return { success: true };
    }

    async beginOAuth(provider: OAuthProvider, redirectTo?: string): Promise<string> {
        const config = this.getProvider(provider);
        const state = randomUUID();
        const normalizedRedirectTo = this.normalizeRedirectTo(redirectTo);
        const payload: IOAuthStatePayload = {
            provider,
            redirectTo: normalizedRedirectTo,
        };

        await this.fastify.redis.set(`auth:oauth:state:${state}`, JSON.stringify(payload), {
            EX: OAUTH_STATE_TTL_SECONDS,
        });

        const url = new URL(config.authorizeUrl);
        url.searchParams.set("client_id", config.clientId);
        url.searchParams.set("redirect_uri", config.redirectUri);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", config.scopes.join(" "));
        url.searchParams.set("state", state);

        if (provider === "google") {
            url.searchParams.set("access_type", "offline");
            url.searchParams.set("prompt", "consent select_account");
        } else {
            url.searchParams.set("prompt", "consent");
        }

        return url.toString();
    }

    private async exchangeOAuthCode(provider: OAuthProvider, code: string): Promise<{ accessToken: string }> {
        const config = this.getProvider(provider);
        const tokenRequest = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: config.redirectUri,
        });

        const response = await fetch(config.tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: tokenRequest.toString(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new AppError(`Не удалось обменять OAuth code: ${errorText}`, 400);
        }

        const data = (await response.json()) as { access_token?: string };

        if (!data.access_token) {
            throw new AppError("OAuth provider не вернул access token", 400);
        }

        return { accessToken: data.access_token };
    }

    private async fetchOAuthProfile(provider: OAuthProvider, accessToken: string): Promise<IOAuthProfile> {
        const config = this.getProvider(provider);
        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
        };

        const response = await fetch(config.profileUrl, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            throw new AppError(`Не удалось получить профиль OAuth: ${errorText}`, 400);
        }

        const data = (await response.json()) as Record<string, unknown>;

        if (provider === "google") {
            const email = typeof data.email === "string" ? data.email : "";
            const id = typeof data.sub === "string" ? data.sub : "";
            const name = typeof data.name === "string" ? data.name : null;
            const avatarUrl = typeof data.picture === "string" ? data.picture : null;

            if (!email || !id) {
                throw new AppError("Google не вернул обязательные данные профиля", 400);
            }

            return { email, id, name, avatarUrl };
        }

        const email = typeof data.email === "string" ? data.email : "";
        const id = typeof data.id === "string" ? data.id : "";
        const username = typeof data.global_name === "string"
            ? data.global_name
            : typeof data.username === "string"
                ? data.username
                : null;
        const avatarHash = typeof data.avatar === "string" ? data.avatar : null;
        const avatarUrl = avatarHash && id
            ? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png`
            : null;

        if (!email || !id) {
            throw new AppError("Discord не вернул email или id. Проверьте scope email и доступность адреса.", 400);
        }

        return { email, id, name: username, avatarUrl };
    }

    async completeOAuth(provider: OAuthProvider, code: string, state: string): Promise<{ session: IAuthResult; redirectTo: string }> {
        if (!code || !state) {
            throw new AppError("OAuth callback не содержит code или state", 400);
        }

        const rawState = await this.fastify.redis.get(`auth:oauth:state:${state}`);

        if (!rawState) {
            throw new UnauthorizedError("OAuth state не найден или истек");
        }

        const parsedState = JSON.parse(rawState) as IOAuthStatePayload;

        if (parsedState.provider !== provider) {
            throw new UnauthorizedError("OAuth state провайдера не совпадает");
        }

        const { accessToken } = await this.exchangeOAuthCode(provider, code);
        const profile = await this.fetchOAuthProfile(provider, accessToken);
        const accountProvider = provider === "google" ? EAccountProvider.Google : EAccountProvider.Discord;
        const { account, user } = await this.getOrCreateAccount(profile.email, accountProvider);

        account.email = normalizeEmail(profile.email);
        await this.saveAccount(account);

        user.avatarUrl = profile.avatarUrl ?? user.avatarUrl;
        user.username = profile.name ?? user.username;
        await this.saveUser(user);
        await invalidateCacheNamespaces(this.fastify, [
            `auth:me:${account.id}`,
            `profile:${account.id}`,
            `messages:user:${user.id}`,
            "servers:list",
            "servers:detail",
            "servers:user",
            "votes:leaderboard",
        ]);
        await this.fastify.redis.del(`auth:oauth:state:${state}`);

        return {
            session: await this.createSession(account, user),
            redirectTo: parsedState.redirectTo,
        };
    }

    async getSecurityStatus(token?: string): Promise<{ twoFactorEnabled: boolean; email: string }> {
        const account = await this.getAccountFromAccessToken(token);
        return await getCachedJson(this.fastify, `auth:security:${account.id}`, {}, 60, async () => ({
            twoFactorEnabled: this.hasActiveSecondFactor(account),
            email: account.email,
        }));
    }

    async startTwoFactorSetup(token?: string, password?: string): Promise<{ twoFactorEnabled: boolean }> {
        const account = await this.getAccountFromAccessToken(token);
        if (!password) {
            throw new AppError("Дополнительный пароль не предоставлен", 400);
        }

        account.twoFactorEnabled = true;
        account.twoFactorEnabledAt = new Date();
        account.secondFactorPasswordHash = hashPasswordValue(password);
        account.twoFactorSecret = null;
        await this.saveAccount(account);

        return { twoFactorEnabled: true };
    }

    async disableTwoFactor(token: string | undefined): Promise<{ twoFactorEnabled: boolean }> {
        const account = await this.getAccountFromAccessToken(token);

        account.twoFactorEnabled = false;
        account.twoFactorEnabledAt = null;
        account.secondFactorPasswordHash = null;
        account.twoFactorSecret = null;
        await this.saveAccount(account);

        return { twoFactorEnabled: false };
    }

}
