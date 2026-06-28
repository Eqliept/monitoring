import { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../errors/appErrors";
import { AuthService } from "./auth.service/auth.service";
import { OAuthProvider } from "./auth.service/auth.types";

function getAuth(request: FastifyRequest) {
    return new AuthService(request.server);
}

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
};

const FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3001";

function buildFrontendAuthUrl(error?: string) {
    const url = new URL("/auth", FRONTEND_URL);

    if (error) {
        url.searchParams.set("error", error);
    }

    return url.toString();
}

function redirectWithAuthError(reply: FastifyReply, error: unknown) {
    if (error instanceof AppError) {
        const errorKey = error.statusCode >= 500 ? "Configuration" : "Authorization";
        return reply.redirect(buildFrontendAuthUrl(errorKey));
    }

    return reply.redirect(buildFrontendAuthUrl("Authorization"));
}

function getProvider(param: string): OAuthProvider {
    if (param === "google" || param === "discord") {
        return param;
    }

    throw new AppError("Неизвестный OAuth provider", 400);
}

export async function login(
    request: FastifyRequest<{ Body: { email: string; redirectTo?: string } }>,
    reply: FastifyReply,
) {
    const auth = getAuth(request);
    await auth.requestMagicLink(request.body.email, request.body.redirectTo);

    return reply.send({ success: true });
}

export async function refresh(request: FastifyRequest, reply: FastifyReply) {
    const auth = getAuth(request);
    const token = request.cookies["refresh_token"];
    const result = await auth.refresh({ token });

    reply
        .setCookie("access_token", result.token, COOKIE_OPTIONS)
        .setCookie("refresh_token", result.refreshToken, COOKIE_OPTIONS);

    return reply.send({ user: result.user });
}

export async function me(request: FastifyRequest, reply: FastifyReply) {
    const auth = getAuth(request);
    const token = request.cookies["access_token"];
    const result = await auth.me(token);

    return reply.send(result);
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
    const auth = getAuth(request);
    const token = request.cookies["refresh_token"];

    await auth.logout({ token });

    reply
        .clearCookie("access_token", COOKIE_OPTIONS)
        .clearCookie("refresh_token", COOKIE_OPTIONS);

    return reply.send({ success: true });
}

export async function oauthStart(
    request: FastifyRequest<{ Params: { provider: string }; Querystring: { redirectTo?: string } }>,
    reply: FastifyReply,
) {
    try {
        const auth = getAuth(request);
        const provider = getProvider(request.params.provider);
        const redirectUrl = await auth.beginOAuth(provider, request.query.redirectTo);

        return reply.redirect(redirectUrl);
    } catch (error) {
        return redirectWithAuthError(reply, error);
    }
}

export async function oauthCallback(
    request: FastifyRequest<{ Params: { provider: string }; Querystring: { code?: string; state?: string } }>,
    reply: FastifyReply,
) {
    try {
        const auth = getAuth(request);
        const provider = getProvider(request.params.provider);
        const code = request.query.code ?? "";
        const state = request.query.state ?? "";
        const { session, redirectTo } = await auth.completeOAuth(provider, code, state);

        reply
            .setCookie("access_token", session.token, COOKIE_OPTIONS)
            .setCookie("refresh_token", session.refreshToken, COOKIE_OPTIONS);

        return reply.redirect(redirectTo);
    } catch (error) {
        return redirectWithAuthError(reply, error);
    }
}

export async function magicConsume(
    request: FastifyRequest<{ Querystring: { token: string } }>,
    reply: FastifyReply,
) {
    try {
        const auth = getAuth(request);
        const { session, redirectTo } = await auth.consumeMagicLink(request.query.token);

        if (session) {
            reply
                .setCookie("access_token", session.token, COOKIE_OPTIONS)
                .setCookie("refresh_token", session.refreshToken, COOKIE_OPTIONS);
        }

        return reply.redirect(redirectTo);
    } catch (error) {
        return redirectWithAuthError(reply, error);
    }
}

export async function verifyTwoFactor(
    request: FastifyRequest<{ Body: { challenge: string; password: string } }>,
    reply: FastifyReply,
) {
    const auth = getAuth(request);
    const { session, redirectTo } = await auth.verifyTwoFactorChallenge(request.body);

    reply
        .setCookie("access_token", session.token, COOKIE_OPTIONS)
        .setCookie("refresh_token", session.refreshToken, COOKIE_OPTIONS);

    return reply.send({ success: true, redirectTo, user: session.user });
}
