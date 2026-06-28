export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Некорректный запрос') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Не авторизован') {
    super(message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Ресурс не найден') {
    super(message, 404);
  }
}