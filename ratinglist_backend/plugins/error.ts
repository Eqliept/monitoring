import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors/appErrors';

export const errorHandlerPlugin = fp(async (fastify: FastifyInstance) => {
    fastify.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Ошибка валидации входных данных',
        details: error.validation 
      });
    }

    if (error instanceof AppError) {
      request.log.warn(`[AppError] ${error.statusCode} - ${error.message}`);
      
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.statusCode === 400 ? 'Bad Request' : 'Error',
        message: error.message
      });
    }

    if (error.statusCode >= 400 && error.statusCode < 500) {
      request.log.warn(`[ClientError] ${error.statusCode} - ${error.message}`);

      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.code ?? 'Bad Request',
        message: error.message
      });
    }

    console.error(`Критическая ошибка при запросе ${request.method} ${request.url}`, error);
    request.log.error(error, `Критическая ошибка при запросе ${request.method} ${request.url}`);

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Что-то пошло не так на нашей стороне. Мы уже чиним!'
    });
  });
});

export default fp(errorHandlerPlugin);
