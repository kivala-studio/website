/** A market payload broke its contract. `operation` names the check, for logs and error mapping. */
export class MarketDecodingError extends Error {
  readonly operation: string;

  constructor(operation: string, detail?: string) {
    super(detail ? `${operation}: ${detail}` : operation);
    this.name = "MarketDecodingError";
    this.operation = operation;
  }
}
