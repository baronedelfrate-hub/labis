// In-memory (module-scoped) token store for the public patient portal.
// Intentionally NOT persisted to localStorage/sessionStorage: a page refresh
// forces the patient to log in again.
let token: string | null = null;

export function setPortalToken(t: string | null) {
  token = t;
}
export function getPortalToken(): string | null {
  return token;
}
