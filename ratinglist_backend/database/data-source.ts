import "reflect-metadata";
import "dotenv/config";
import { DataSource, DataSourceOptions } from "typeorm";
import { AccountEntity } from "./entities/account.entity";
import { BalanceTopUpEntity } from "./entities/balance-top-up.entity";
import { BlogPostEntity } from "./entities/blog-post.entity";
import { MessageAttachmentEntity } from "./entities/message-attachment.entity";
import { MessageConversationEntity } from "./entities/message-conversation.entity";
import { MessageLinkEntity } from "./entities/message-link.entity";
import { MessageReadStateEntity } from "./entities/message-read-state.entity";
import { MessageEntity } from "./entities/message.entity";
import { ServerAnalyticsEntity } from "./entities/server-analytics.entity";
import { ServerEntity } from "./entities/server.entity";
import { ServerSearchEmbeddingEntity } from "./entities/server-search-embedding.entity";
import { ServerTaxonomyItemEntity } from "./entities/server-taxonomy-item.entity";
import { ServerVoteEntity } from "./entities/server-vote.entity";
import { SiteVisitSessionEntity } from "./entities/site-visit-session.entity";
import { UserEntity } from "./entities/users.entity";

export const dataSourceOptions: DataSourceOptions = {
    type: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [
        AccountEntity,
        BalanceTopUpEntity,
        BlogPostEntity,
        MessageAttachmentEntity,
        MessageConversationEntity,
        MessageEntity,
        MessageLinkEntity,
        MessageReadStateEntity,
        ServerAnalyticsEntity,
        ServerEntity,
        ServerSearchEmbeddingEntity,
        ServerTaxonomyItemEntity,
        ServerVoteEntity,
        SiteVisitSessionEntity,
        UserEntity,
    ],
    migrations: [__dirname + "/migrations/*.{js,ts}"],
    subscribers: [__dirname + "/subscribers/*.{js,ts}"],
    synchronize: process.env.NODE_ENV === "development" ? true : false,
    logging: process.env.NODE_ENV === "development" ? true : false,
};

export default new DataSource(dataSourceOptions);
