import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "order_app_session";
const secretKey = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export type SessionPayload = {
  employeeId: string;
  name: string;
  store: string;
  role: string;
};

// JWT + httpOnly 쿠키 방식을 선택한 이유:
// - 서버 세션 저장소(Redis 등)를 따로 둘 필요 없이 Vercel의 서버리스 환경에 잘 맞음
// - httpOnly + secure 쿠키라 클라이언트 JS에서 토큰을 읽을 수 없어 XSS로부터 비교적 안전
// - 만료시간을 JWT 자체에 넣어 무상태(stateless)로 검증 가능

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12시간
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
