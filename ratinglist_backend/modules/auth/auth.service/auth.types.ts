import { Secret, JwtPayload } from "jsonwebtoken";

export type TSecret = Secret;
export type TExpiration = string | number;
export type OAuthProvider = "google" | "discord";

export interface IUser {
    id: string;
    email: string;
    provider?: string;
    name?: string | null;
    avatarUrl?: string | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    telegram?: string | null;
    twoFactorEnabled?: boolean;
    balanceRub?: number;
}

export interface IAuthResult {
    token: string;
    refreshToken: string;
    user: IUser;
}

export interface IRefreshRequest {
    token?: string;
}

export interface IPayload extends JwtPayload {
    sub: string;
    email: string;
}

export interface IOAuthStatePayload {
    provider: OAuthProvider;
    redirectTo: string;
}

export interface IOAuthProfile {
    email: string;
    id: string;
    name?: string | null;
    avatarUrl?: string | null;
}

export interface IMagicLinkPayload {
    email: string;
    redirectTo: string;
}

export interface ITwoFactorSetupPayload {
    secret: string;
    redirectTo?: string;
}

export interface IProfileUpdatePayload {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    telegram?: string | null;
    avatarUrl?: string | null;
}

export interface IVerifyTwoFactorRequest {
    challenge: string;
    password: string;
}
