import { NextRequest, NextResponse } from "next/server";
import { saveKakaoAuth } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`카카오 로그인 동의가 취소되었습니다: ${error}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!code) {
    return new NextResponse("code 파라미터가 없습니다.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const clientId = process.env.KAKAO_REST_API_KEY;
  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return new NextResponse(
      "KAKAO_REST_API_KEY 또는 KAKAO_REDIRECT_URI 환경변수가 설정되지 않았습니다.",
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: body.toString(),
  });
  const json: any = await res.json().catch(() => ({}));

  if (!res.ok || !json.refresh_token) {
    console.error("kakao token exchange failed", json);
    return new NextResponse(`토큰 교환 실패: ${JSON.stringify(json)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  await saveKakaoAuth({ refreshToken: json.refresh_token });

  return new NextResponse(
    "카카오 '나에게 보내기' 연동이 완료되었습니다.\n이제 매일 23:00 발주서가 생성되면 자동으로 카카오톡 메시지가 옵니다.\n이 창은 닫으셔도 됩니다.",
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
