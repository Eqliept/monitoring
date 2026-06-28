import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { ServerScannerService, serverScanIntervalMs } from "../modules/analytics/analytics.service/server-scanner.service";

async function serverScannerPlugin(fastify: FastifyInstance) {
    const scanner = new ServerScannerService(fastify);
    const runScanner = () => {
        void scanner.scanAllServers().catch((error) => {
            console.error("Ошибка проверки серверов:", error);
        });
    };

    fastify.addHook("onReady", async () => {
        runScanner();
    });

    const timer = setInterval(runScanner, serverScanIntervalMs);
    timer.unref();

    fastify.addHook("onClose", async () => {
        clearInterval(timer);
    });
}

export default fp(serverScannerPlugin);
