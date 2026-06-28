import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity("blog_posts")
@Index(["createdAt"])
export class BlogPostEntity {
    @PrimaryColumn()
    id!: string;

    @Column({ type: "varchar", length: 180 })
    title!: string;

    @Column({ type: "text" })
    imageUrl!: string;

    @Column({ type: "varchar", length: 220 })
    summary!: string;

    @Column({ type: "text" })
    content!: string;

    @Column({ type: "boolean", default: true })
    isPublished!: boolean;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
