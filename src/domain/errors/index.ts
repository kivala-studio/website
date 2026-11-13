export {
  APP_ERROR_CATEGORIES,
  AccountSessionError,
  AppError,
  CancellationError,
  DecodingError,
  HttpError,
  sameAppError,
  type AppErrorCategory,
  type AppErrorInit,
  type CauseGroup,
} from "./app-error";
export {
  ErrorCoordinator,
  type ErrorCoordinatorState,
  type ErrorEntry,
  type PresentOptions,
  type RetryAction,
} from "./coordinator";
export { ERROR_MESSAGE_KEYS, type ErrorMessageKey } from "./keys";
export {
  boundaryError,
  httpCategory,
  isCancellation,
  mapError,
  postgrestCode,
  retryAfterFromBody,
  retryAfterSeconds,
  serverRule,
  type AuthErrorShape,
  type FunctionsErrorShape,
  type PostgrestErrorShape,
} from "./map";
export {
  presentError,
  type ErrorContext,
  type ErrorPresentation,
  type ErrorSeverity,
  type ErrorStyle,
} from "./presentation";
export {
  SERVER_RULE_CODES,
  UPGRADE_REASON_KEYS,
  parseServerRule,
  type ServerRule,
  type ServerRuleCode,
  type UpgradeReason,
} from "./rules";
