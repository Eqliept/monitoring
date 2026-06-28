import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import { In } from "typeorm";

import {
    EServerTaxonomyVariant,
    ServerTaxonomyItemEntity,
} from "../../../database/entities/server-taxonomy-item.entity";
import { AppError, NotFoundError } from "../../../errors/appErrors";
import { getCachedJson, invalidateCacheNamespaces } from "../../../utils/cache";
import {
    ServerTaxonomyCreateBody,
    ServerTaxonomyReorderBody,
    ServerTaxonomyUpdateBody,
} from "../server-taxonomy.types";

const groupLabels: Record<string, string> = {
    versions: "Версии",
    serverTypes: "Типы серверов",
    gameModes: "Режимы",
    rules: "Правила сервера",
    systems: "Системы",
    miniGames: "Мини-игры",
    mods: "Моды",
};

function normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

export class ServerTaxonomyService {
    constructor(private readonly fastify: FastifyInstance) {}

    private get taxonomyRepository() {
        return this.fastify.dataSource.getRepository(ServerTaxonomyItemEntity);
    }

    private serializeItem(item: ServerTaxonomyItemEntity) {
        return {
            id: item.id,
            groupKey: item.groupKey,
            groupLabel: item.groupLabel,
            name: item.name,
            type: item.variant,
            variant: item.variant,
            sortOrder: item.sortOrder,
            isActive: item.isActive,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }

    async listItems(options: { includeInactive?: boolean } = {}) {
        return await getCachedJson(
            this.fastify,
            "server-taxonomy",
            { includeInactive: Boolean(options.includeInactive) },
            300,
            async () => {
                const items = await this.taxonomyRepository.find({
                    where: options.includeInactive ? undefined : { isActive: true },
                    order: {
                        groupKey: "ASC",
                        sortOrder: "ASC",
                        name: "ASC",
                    },
                });
                const groups = Object.entries(groupLabels).map(([groupKey, groupLabel]) => ({
                    key: groupKey,
                    label: groupLabel,
                    items: items
                        .filter((item) => item.groupKey === groupKey)
                        .map((item) => this.serializeItem(item)),
                }));

                return { groups };
            },
        );
    }

    async createItem(payload: ServerTaxonomyCreateBody) {
        const name = normalizeName(payload.name);
        const duplicate = await this.taxonomyRepository.findOne({
            where: {
                groupKey: payload.groupKey,
                name,
            },
        });

        if (duplicate) {
            throw new AppError("Такой элемент уже есть в группе", 409);
        }

        const count = await this.taxonomyRepository.count({ where: { groupKey: payload.groupKey } });
        const item = this.taxonomyRepository.create({
            id: randomUUID(),
            groupKey: payload.groupKey,
            groupLabel: payload.groupLabel?.trim() || groupLabels[payload.groupKey],
            name,
            variant: payload.variant ?? EServerTaxonomyVariant.Default,
            sortOrder: count,
            isActive: payload.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await this.taxonomyRepository.save(item);
        await invalidateCacheNamespaces(this.fastify, ["server-taxonomy"]);

        return { item: this.serializeItem(item) };
    }

    async updateItem(itemId: string, payload: ServerTaxonomyUpdateBody) {
        const item = await this.taxonomyRepository.findOne({ where: { id: itemId } });

        if (!item) {
            throw new NotFoundError("Элемент справочника не найден");
        }

        if (payload.name !== undefined) {
            const nextName = normalizeName(payload.name);
            const duplicate = await this.taxonomyRepository.findOne({
                where: {
                    groupKey: item.groupKey,
                    name: nextName,
                },
            });

            if (duplicate && duplicate.id !== item.id) {
                throw new AppError("Такой элемент уже есть в группе", 409);
            }

            item.name = nextName;
        }

        if (payload.groupLabel !== undefined) {
            item.groupLabel = payload.groupLabel.trim();
        }

        if (payload.variant !== undefined) {
            item.variant = payload.variant;
        }

        if (payload.isActive !== undefined) {
            item.isActive = payload.isActive;
        }

        item.updatedAt = new Date();
        await this.taxonomyRepository.save(item);
        await invalidateCacheNamespaces(this.fastify, ["server-taxonomy"]);

        return { item: this.serializeItem(item) };
    }

    async deleteItem(itemId: string) {
        const item = await this.taxonomyRepository.findOne({ where: { id: itemId } });

        if (!item) {
            throw new NotFoundError("Элемент справочника не найден");
        }

        await this.taxonomyRepository.remove(item);
        await invalidateCacheNamespaces(this.fastify, ["server-taxonomy"]);

        return { success: true };
    }

    async reorderItems(payload: ServerTaxonomyReorderBody) {
        const items = await this.taxonomyRepository.find({
            where: {
                id: In(payload.itemIds),
                groupKey: payload.groupKey,
            },
        });

        if (items.length !== payload.itemIds.length) {
            throw new AppError("В списке сортировки есть неизвестные элементы", 400);
        }

        const itemsById = new Map(items.map((item) => [item.id, item]));
        const now = new Date();

        payload.itemIds.forEach((itemId, index) => {
            const item = itemsById.get(itemId);

            if (item) {
                item.sortOrder = index;
                item.updatedAt = now;
            }
        });

        await this.taxonomyRepository.save(Array.from(itemsById.values()));
        await invalidateCacheNamespaces(this.fastify, ["server-taxonomy"]);

        return await this.listItems({ includeInactive: true });
    }
}
