import { NextResponse } from "next/server";

// John이 브라우저에서 이 주소를 한 번 열고 카카오 로그인 동의를 하면
// /api/kakao/oauth/callback 으로 code가 전달되어 refresh_token이 저장됩니다.
export async function GET() {
  const clientId = process.env.KAKAO_REST_API_KEY;
  const redirectUri = process.env.KAKAO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "KAKAO_REST_API_KEY 또는 KAKAO_REDIRECT_URI 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "talk_message");

  return NextResponse.redirect(url.toString());
}
