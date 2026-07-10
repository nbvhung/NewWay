export interface TokenPayload {
  sub: number;
  username: string;
  fullName: string;
  role: string;
  jti?: string;
}

export interface RequestWithUser extends Request {
  user: TokenPayload & { fullName: string };
}
