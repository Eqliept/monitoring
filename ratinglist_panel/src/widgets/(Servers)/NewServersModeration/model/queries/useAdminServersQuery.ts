import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveAdminServer,
  loadAdminServers,
  rejectAdminServer,
  updateAdminServer,
} from "../api/adminServersApi";
import type {
  AdminServerUpdatePayload,
  ServerModerationStatus,
} from "../../types";

const adminServersQueryKey = ["admin-servers"];

export function useAdminServersQuery(status: ServerModerationStatus = "review_pending") {
  return useQuery({
    queryKey: [...adminServersQueryKey, status],
    queryFn: () => loadAdminServers(status),
  });
}

export function useUpdateAdminServerMutation(status: ServerModerationStatus = "review_pending") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, payload }: { serverId: string; payload: AdminServerUpdatePayload }) => (
      updateAdminServer(serverId, payload)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...adminServersQueryKey, status] }),
  });
}

export function useApproveAdminServerMutation(status: ServerModerationStatus = "review_pending") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, comment }: { serverId: string; comment?: string }) => (
      approveAdminServer(serverId, comment)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...adminServersQueryKey, status] }),
  });
}

export function useRejectAdminServerMutation(status: ServerModerationStatus = "review_pending") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, comment }: { serverId: string; comment?: string }) => (
      rejectAdminServer(serverId, comment)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...adminServersQueryKey, status] }),
  });
}
