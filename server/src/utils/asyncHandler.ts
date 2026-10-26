import { Request, Response, NextFunction, RequestHandler } from 'express';

/** 包裹异步路由，把 Promise 异常交给 Express 错误中间件，避免未捕获拒绝导致进程退出 */
export function asyncHandler(
  fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
