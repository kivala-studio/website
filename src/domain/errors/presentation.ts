import type { AppError } from "./app-error";
import type { ErrorMessageKey } from "./keys";

export type ErrorContext = "initialLoad" | "refresh" | "action" | "authentication" | "signOut";
export type ErrorStyle = "inline" | "banner" | "alert" | "fullContent";
export type ErrorSeverity = "informational" | "recoverable" | "blocking" | "authenticationRequired";

export type ErrorPresentation = {
  readonly titleKey: ErrorMessageKey;
  readonly messageKey: ErrorMessageKey;
  /** Label of the user-initiated retry button; null when none is offered. */
  readonly actionKey: ErrorMessageKey | null;
  readonly severity: ErrorSeverity;
  readonly style: ErrorStyle;
};

function failureTitle(operation: string, context: ErrorContext): ErrorMessageKey {
  switch (operation) {
    case "market.load":
      return context === "refresh" ? "errors.market.refreshFailed" : "errors.market.loadFailed";
    case "market.history":
    case "market.intraday":
      return "errors.market.priceHistoryFailed";
    case "portfolio.load":
      return "errors.portfolio.loadFailed";
    case "portfolio.create":
    case "portfolio.update":
      return "errors.portfolio.savePurchaseFailed";
    case "portfolio.delete":
      return "errors.portfolio.deletePurchaseFailed";
    case "alerts.load":
      return "errors.notification.loadAlertsFailed";
    case "chart.export":
    case "chart.render":
      return "errors.chart.shareFailed";
    case "auth.signOut":
      return "errors.account.signOutFailed";
    case "auth.restore":
      return "common.sessionRecoveryFailed";
    case "account.delete":
      return "errors.account.deleteFailed";
  }
  if (operation.startsWith("watchlist.")) return "errors.watchlist.updateFailed";
  if (operation.startsWith("alert.")) return "errors.alert.updateFailed";
  if (operation.startsWith("notification.")) return "errors.notification.markReadFailed";
  if (context === "authentication" || operation.startsWith("auth.")) return "errors.account.signInFailed";
  if (context === "refresh") return "common.refreshFailed";
  return context === "action" ? "errors.generic.saveFailed" : "errors.generic.loadFailed";
}

function copy(error: AppError, context: ErrorContext): Pick<ErrorPresentation, "titleKey" | "messageKey"> {
  if (context === "signOut") {
    return { titleKey: "errors.session.signedOutHereTitle", messageKey: "errors.session.signOutOthersFailed" };
  }
  if (error.requiresAuthentication) {
    return error.category === "sessionExpired"
      ? { titleKey: "errors.session.signInAgainTitle", messageKey: "errors.session.expiredMessage" }
      : { titleKey: "errors.session.signInTitle", messageKey: "errors.session.signInMessage" };
  }
  // A refused action names what failed and quotes the rule; rules without copy fall through.
  if (error.rule?.messageKey) {
    return { titleKey: failureTitle(error.operation, context), messageKey: error.rule.messageKey };
  }
  switch (error.category) {
    case "offline":
    case "connectionLost":
    case "timeout":
      return {
        titleKey:
          context === "refresh"
            ? "common.refreshFailed"
            : error.category === "timeout"
              ? "errors.network.timeoutTitle"
              : "common.noInternet",
        messageKey: "errors.network.checkConnection",
      };
    case "unauthorized":
      return { titleKey: "errors.permission.deniedTitle", messageKey: "errors.permission.deniedMessage" };
    case "decoding":
    case "invalidResponse":
      return { titleKey: "errors.data.unreadableTitle", messageKey: "errors.data.unreadableMessage" };
    case "missingData":
    case "unavailableInstrument":
      return { titleKey: "common.informationUnavailable", messageKey: "errors.data.chooseAnotherInstrument" };
    case "validation":
      return { titleKey: "errors.validation.title", messageKey: "errors.validation.message" };
    case "unsupportedOperation":
      return { titleKey: "common.actionUnavailable", messageKey: "errors.validation.unavailableForInstrument" };
    case "invalidState":
      return { titleKey: "errors.generic.title", messageKey: "errors.generic.message" };
    case "rateLimited":
      return { titleKey: "errors.rateLimit.title", messageKey: "errors.rateLimit.message" };
    default:
      return { titleKey: failureTitle(error.operation, context), messageKey: "errors.service.unavailable" };
  }
}

/** Catalogue keys and layout for a failure. Backend text is never part of it. */
export function presentError(error: AppError, context: ErrorContext = "initialLoad"): ErrorPresentation {
  const passive = context === "refresh" || context === "signOut";
  const severity: ErrorSeverity = error.requiresAuthentication
    ? "authenticationRequired"
    : error.category === "invalidState"
      ? "blocking"
      : passive
        ? "informational"
        : "recoverable";
  const style: ErrorStyle =
    error.category === "invalidState"
      ? "alert"
      : passive || context === "action"
        ? "banner"
        : context === "authentication"
          ? "inline"
          : "fullContent";
  return {
    ...copy(error, context),
    actionKey: error.userCanRetry && context !== "signOut" ? "common.tryAgain" : null,
    severity,
    style,
  };
}
