import fp from "fastify-plugin";
import { DataSource } from "typeorm";
import { FastifyInstance } from "fastify";
import { dataSourceOptions } from "../database/data-source";

declare module "fastify" {
    interface FastifyInstance {
        dataSource: DataSource
    }
}

async function typeorm(fastify: FastifyInstance) {
    const dataSource = new DataSource(dataSourceOptions)

    await dataSource.initialize()

    fastify.decorate("dataSource", dataSource)

    fastify.addHook("onClose", async () => {
        await dataSource.destroy()
    })
}

export default fp(typeorm)
