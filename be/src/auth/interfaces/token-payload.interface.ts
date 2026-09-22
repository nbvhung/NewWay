export interface TokenPayload {
  sub: number;
  username: string;
  fullName: string;
  role: string;
  permissions?: string[];
  visibleDriverIds?: number[];
  jti?: string;
}

export interface RequestWithUser extends Request {
  user: TokenPayload & { fullName: string };
}
