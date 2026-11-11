/** Request header the proxy sets to the visitor's path and query, so layouts can send them back after sign-in. */
export const REQUEST_PATH_HEADER = "x-investao-path";

/** Request header the proxy sets when a saved session could not be refreshed for a connectivity reason. */
export const SESSION_STATE_HEADER = "x-investao-session";
export const SESSION_UNAVAILABLE = "unavailable";
