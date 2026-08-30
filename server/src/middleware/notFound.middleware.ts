import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.ts";

const notFound = (_req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound("NOT FOUND"));
};

export { notFound };
