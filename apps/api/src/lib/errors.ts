export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST") => new HttpError(400, code, message);
export const unauthorized = (message = "请先登录") => new HttpError(401, "UNAUTHORIZED", message);
export const notFound = (message = "内容不存在") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (message: string, code = "CONFLICT") => new HttpError(409, code, message);
