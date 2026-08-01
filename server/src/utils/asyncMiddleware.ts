import type { Request, Response, NextFunction } from "express";

const asyncMiddleware =
  (
    fn: (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => Promise<void> | void,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    let nextCalled = false;
    const wrappedNext: NextFunction = ((...args: any[]) => {
      nextCalled = true;
      next(...args);
    }) as NextFunction;

    Promise.resolve(fn(req, res, wrappedNext))
      .then(() => {
        if (!nextCalled && !res.headersSent) {
          next();
        }
      })
      .catch(next);
  };

export { asyncMiddleware };
