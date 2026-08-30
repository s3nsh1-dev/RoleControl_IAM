class AppResponse<T = unknown> {
  public readonly statusCode: number;
  public readonly success: boolean;
  public readonly message: string;
  public readonly data: T | undefined;
  public readonly timestamp: string;

  constructor(statusCode: number, message: string, data?: T) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  // Express is calling this when res.json(this) happens. toJSON is method name used when we call json(), Express call toJSON serializes the object compatible for transferring. seeing a custom toJSON already attached to the AppResponse object, Express uses this toJSON instead and we wrote a custom return statement for sharing in the shape what we want.
  toJSON() {
    return {
      success: this.success,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
      timestamp: this.timestamp,
    };
  }

  /** Helper: send this response via Express `res` */
  send(res: import("express").Response) {
    return res.status(this.statusCode).json(this);
  }
}

export { AppResponse };
