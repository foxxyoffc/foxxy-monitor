export type ApplicationRole = "owner" | "admin" | "user";
export type ApplicationStatus = "active" | "blacklisted" | "deleted";

export function canAccessOwnerControl(role: ApplicationRole) {
  return role === "owner";
}

export function isSessionAccepted(isActive: boolean, status: ApplicationStatus) {
  return isActive && status === "active";
}
