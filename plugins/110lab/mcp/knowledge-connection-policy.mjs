const transientStatus = new Set([429, 502, 503, 504]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createKnowledgeRecoveryFetch(
  endpoint,
  catalog,
  fetcher = fetch,
) {
  const readonly = new Set(
    catalog
      .filter((t) => t.annotations?.readOnlyHint === true)
      .map((t) => t.name),
  );
  const state = { failure: undefined };
  function replayable(url, init) {
    if ((init?.method || "GET") === "GET") return true;
    if (String(url) !== endpoint || typeof init?.body !== "string")
      return false;
    try {
      const message = JSON.parse(init.body);
      return (
        ["initialize", "tools/list", "resources/list", "prompts/list"].includes(
          message.method,
        ) ||
        (message.method === "tools/call" && readonly.has(message.params?.name))
      );
    } catch {
      return false;
    }
  }
  return {
    reset() {
      state.failure = undefined;
    },
    get failure() {
      return state.failure;
    },
    async fetch(url, init) {
      // This upstream has no background stream. All auth runs under the lease.
      if (String(url) === endpoint && init?.method === "GET")
        return new Response(null, { status: 405 });
      const attempts = replayable(url, init) ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt++) {
        let response;
        try {
          response = await fetcher(url, init);
        } catch (error) {
          state.failure = { kind: "network" };
          if (attempt + 1 < attempts && !init?.signal?.aborted) {
            await delay(200);
            continue;
          }
          throw error;
        }
        if (response.ok) {
          state.failure = undefined;
          return response;
        }
        const wait = response.headers.get("retry-after");
        const retryAfter =
          wait === null
            ? 0
            : /^\d+$/.test(wait)
              ? Number(wait)
              : Math.max(0, Math.ceil((Date.parse(wait) - Date.now()) / 1000));
        state.failure = {
          kind: "http",
          status: response.status,
          ...(Number.isFinite(retryAfter) && retryAfter > 0
            ? { retryAfterSeconds: retryAfter }
            : {}),
        };
        // Never replay token/code exchanges or business writes. A token response
        // may have been lost after rotation; a write may already have committed.
        if (
          transientStatus.has(response.status) &&
          attempt + 1 < attempts &&
          retryAfter <= 1
        ) {
          await response.body?.cancel();
          await delay(Math.max(200, retryAfter * 1000));
          continue;
        }
        return response;
      }
    },
  };
}

export function knowledgeConnectionFailure(failure, hasTokens, write = false) {
  if (!hasTokens || failure?.status === 401)
    return {
      error: "AUTH_REQUIRED",
      authorizationRequired: true,
      next: "The saved knowledge authorization is missing or rejected. Call kb_connect only to restore it; the user must approve in the browser.",
    };
  if (failure?.status === 403)
    return {
      error: "PERMISSION_DENIED",
      authorizationRequired: false,
      next: "Check the granted scope and resource permission. Do not restart login for a permission error.",
    };
  return {
    error: write ? "CONNECTION_UNCONFIRMED" : "SERVICE_UNAVAILABLE",
    authorizationRequired: false,
    ...(failure?.retryAfterSeconds
      ? { retryAfterSeconds: failure.retryAfterSeconds }
      : {}),
    next: write
      ? "The write outcome is unknown. Keep the existing authorization and requestId; query its operation receipt before any retry. Do not call kb_connect for a temporary outage."
      : "The knowledge service or network is temporarily unavailable. Keep the existing authorization and retry later. Do not call kb_connect unless authorization is explicitly rejected.",
  };
}
