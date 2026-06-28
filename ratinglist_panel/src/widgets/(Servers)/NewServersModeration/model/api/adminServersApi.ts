import type {
  AdminServerUpdatePayload,
  AdminServersResponse,
  ServerModerationStatus,
} from "../../types";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const adminServersBaseUrl = `${backendUrl}/api/servers/admin`;

async function parseAdminServersResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Ошибка модерации серверов";

    try {
      const text = await response.clone().text();
      const data = text ? JSON.parse(text) : null;
      message = typeof data?.message === "string" ? data.message : message;
    } catch {
      const text = await response.clone().text();

      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function loadAdminServers(
  status: ServerModerationStatus = "review_pending",
): Promise<AdminServersResponse> {
  const url = new URL(`${adminServersBaseUrl}/pending`);
  url.searchParams.set("status", status);

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
  });

  return await parseAdminServersResponse<AdminServersResponse>(response);
}

export async function updateAdminServer(
  serverId: string,
  payload: AdminServerUpdatePayload,
): Promise<void> {
  const response = await fetch(`${adminServersBaseUrl}/${encodeURIComponent(serverId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  await parseAdminServersResponse(response);
}

export async function approveAdminServer(serverId: string, comment?: string): Promise<void> {
  const response = await fetch(`${adminServersBaseUrl}/${encodeURIComponent(serverId)}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ comment: comment || null }),
  });

  await parseAdminServersResponse(response);
}

export async function rejectAdminServer(serverId: string, comment?: string): Promise<void> {
  const response = await fetch(`${adminServersBaseUrl}/${encodeURIComponent(serverId)}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ comment: comment || null }),
  });

  await parseAdminServersResponse(response);
}
