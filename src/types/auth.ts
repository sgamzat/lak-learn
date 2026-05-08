export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  isBlocked: boolean;
}

export interface AuthResponse {
  user: Omit<AuthUser, "isBlocked">;
}

