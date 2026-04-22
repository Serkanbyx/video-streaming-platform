export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export const httpError = (status: number, message: string): HttpError =>
  new HttpError(status, message);
