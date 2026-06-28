import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTaxonomyItem,
  deleteTaxonomyItem,
  loadTaxonomyAdmin,
  reorderTaxonomyItems,
  updateTaxonomyItem,
} from "../api/taxonomyApi";
import type {
  TaxonomyCreatePayload,
  TaxonomyGroupKey,
  TaxonomyItem,
  TaxonomyResponse,
  TaxonomyUpdatePayload,
} from "../../types";

const taxonomyQueryKey = ["server-taxonomy-admin"];

export function useTaxonomyQuery() {
  return useQuery({
    queryKey: taxonomyQueryKey,
    queryFn: loadTaxonomyAdmin,
  });
}

export function useCreateTaxonomyItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TaxonomyCreatePayload) => createTaxonomyItem(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyQueryKey }),
  });
}

export function useUpdateTaxonomyItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: TaxonomyUpdatePayload }) => (
      updateTaxonomyItem(itemId, payload)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyQueryKey }),
  });
}

export function useDeleteTaxonomyItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => deleteTaxonomyItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyQueryKey }),
  });
}

export function useReorderTaxonomyItemsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupKey, itemIds }: { groupKey: TaxonomyGroupKey; itemIds: string[] }) => (
      reorderTaxonomyItems(groupKey, itemIds)
    ),
    onMutate: async ({ groupKey, itemIds }) => {
      await queryClient.cancelQueries({ queryKey: taxonomyQueryKey });

      const previousTaxonomy = queryClient.getQueryData<TaxonomyResponse>(taxonomyQueryKey);

      queryClient.setQueryData<TaxonomyResponse>(taxonomyQueryKey, (currentTaxonomy) => {
        if (!currentTaxonomy) {
          return currentTaxonomy;
        }

        return {
          ...currentTaxonomy,
          groups: currentTaxonomy.groups.map((group) => {
            if (group.key !== groupKey) {
              return group;
            }

            const itemsById = new Map(group.items.map((item) => [item.id, item]));
            const orderedItems = itemIds
              .map<TaxonomyItem | null>((itemId, sortOrder) => {
                const item = itemsById.get(itemId);
                return item ? { ...item, sortOrder } : null;
              })
              .filter((item): item is TaxonomyItem => item !== null);
            const missingItems = group.items
              .filter((item) => !itemIds.includes(item.id))
              .map((item, offset) => ({ ...item, sortOrder: orderedItems.length + offset }));

            return {
              ...group,
              items: [...orderedItems, ...missingItems],
            };
          }),
        };
      });

      return { previousTaxonomy };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTaxonomy) {
        queryClient.setQueryData(taxonomyQueryKey, context.previousTaxonomy);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taxonomyQueryKey }),
  });
}
