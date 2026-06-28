import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export enum EServerTaxonomyVariant {
    Default = "default",
    Primary = "primary",
}

@Entity("server_taxonomy_items")
@Index(["groupKey", "name"], { unique: true })
@Index(["groupKey", "sortOrder"])
export class ServerTaxonomyItemEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar" })
    groupKey!: string;

    @Column({ type: "varchar" })
    groupLabel!: string;

    @Column({ type: "varchar" })
    name!: string;

    @Column({
        type: "enum",
        enum: EServerTaxonomyVariant,
        default: EServerTaxonomyVariant.Default,
    })
    variant!: EServerTaxonomyVariant;

    @Column({ type: "integer", default: 0 })
    sortOrder!: number;

    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
