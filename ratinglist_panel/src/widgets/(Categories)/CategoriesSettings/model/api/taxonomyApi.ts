import type {
  TaxonomyCreatePayload,
  TaxonomyResponse,
  TaxonomyUpdatePayload,
} from "../../types";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const taxonomyBaseUrl = `${backendUrl}/api/server-taxonomy`;

async function parseTaxonomyResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Ошибка справочников";

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

export async function loadTaxonomyAdmin(): Promise<TaxonomyResponse> {
  const response = await fetch(`${taxonomyBaseUrl}/admin`, {
    method: "GET",
    credentials: "include",
  });

  return await parseTaxonomyResponse<TaxonomyResponse>(response);
}

export async function createTaxonomyItem(payload: TaxonomyCreatePayload): Promise<void> {
  const response = await fetch(taxonomyBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  await parseTaxonomyResponse(response);
}

export async function updateTaxonomyItem(itemId: string, payload: TaxonomyUpdatePayload): Promise<void> {
  const response = await fetch(`${taxonomyBaseUrl}/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  await parseTaxonomyResponse(response);
}

export async function deleteTaxonomyItem(itemId: string): Promise<void> {
  const response = await fetch(`${taxonomyBaseUrl}/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    credentials: "include",
  });

  await parseTaxonomyResponse(response);
}

export async function reorderTaxonomyItems(groupKey: string, itemIds: string[]): Promise<void> {
  const response = await fetch(`${taxonomyBaseUrl}/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ groupKey, itemIds }),
  });

  await parseTaxonomyResponse(response);
}
