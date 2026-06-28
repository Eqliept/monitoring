export type ServerModerationStatus = "motd_pending" | "review_pending" | "approved" | "rejected";

export interface AdminServerOwner {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  name: string;
}

export interface AdminServerLatestStatus {
  isOnline: boolean;
  latencyMs: number | null;
  playersOnline: number | null;
  playersMax: number | null;
  versionName: string | null;
  protocolVersion: number | null;
  motd: string | null;
  checkedAt: string | null;
}

export interface AdminServerItem {
  id: string;
  slug: string;
  name: string;
  ip: string;
  port: number;
  slogan: string | null;
  description: string | null;
  website: string | null;
  youtube: string | null;
  discord: string | null;
  telegram: string | null;
  vk: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  categories: Record<string, unknown>;
  imageUrls: string[];
  versions: string[];
  rating: number;
  isMotdVerified: boolean;
  moderationStatus: ServerModerationStatus;
  moderationComment: string | null;
  motdVerifiedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestStatus: AdminServerLatestStatus | null;
  owner: AdminServerOwner | null;
}

export interface AdminServersResponse {
  items: AdminServerItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminServerUpdatePayload {
  name?: string;
  slogan?: string | null;
  description?: string | null;
  website?: string | null;
  youtube?: string | null;
  discord?: string | null;
  telegram?: string | null;
  vk?: string | null;
  banner?: string[];
  logo?: string[];
  images?: string[];
  categories?: Record<string, unknown>;
  versions?: string[];
}
