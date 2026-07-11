// 카카오 로그인 "나에게 보내기" API (talk_message)
//
// 카카오톡 알림톡(비즈메시지)과 달리 사업자 인증이 필요 없습니다.
// John이 /api/kakao/oauth/start 에서 최초 1회 카카오 로그인 동의를 하면
// refresh_token을 Notion(KAKAO_AUTH)에 저장해두고, 이후에는 매 발송 시
// refresh_token으로 access_token을 새로 발급받아 사용합니다.
//
// 문서: https://developers.kakao.com/docs/ko/kakaotalk-message/rest-api
//       https://developers.kakao.com/docs/ko/message-template/default#text-object

import { getKakaoAuth, saveKakaoAuth } from "./notion";

const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";

async function refreshAccessToken(): Promise<string> {
  const auth = await getKakaoAuth();
  if (!auth?.refreshToken) {
    throw new Error(
      "카카오 refresh_token이 없습니다. /api/kakao/oauth/start 에서 최초 연동을 먼저 진행하세요."
    );
  }

  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    throw new Error("KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: auth.refreshToken,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: body.toString(),
  });
  const json: any = await res.json().catch(() => ({}));

  if (!res.ok || !json.access_token) {
    throw new Error(`카카오 액세스 토큰 갱신 실패: ${JSON.stringify(json)}`);
  }

  // 카카오는 만료가 임박한 경우에만 refresh_token을 새로 내려줍니다.
  // 내려온 경우에만 갱신 저장하고, 없으면 기존 값을 그대로 둡니다.
  if (json.refresh_token && json.refresh_token !== auth.refreshToken) {
    await saveKakaoAuth({ refreshToken: json.refresh_token }).catch((err) => {
      console.error("카카오 refresh_token 갱신 저장 실패 (다음 발송에 영향 없음)", err);
    });
  }

  return json.access_token as string;
}

export async function sendKakaoTextToJohn(params: {
  text: string; // 최대 200자 (카카오 텍스트 템플릿 제한)
  webUrl: string;
  buttonTitle?: string;
}): Promise<void> {
  const accessToken = await refreshAccessToken();

  const templateObject = {
    object_type: "text",
    text: params.text.slice(0, 200),
    link: {
      web_url: params.webUrl,
      mobile_web_url: params.webUrl,
    },
    button_title: params.buttonTitle ?? "발주서 확인하기",
  };

  const body = new URLSearchParams({ template_object: JSON.stringify(templateObject) });
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      Authorization: `Bearer ${accessToken}`,
    },
    body: body.toString(),
  });
  const json: any = await res.json().catch(() => ({}));

  if (!res.ok || json.result_code !== 0) {
    throw new Error(`카카오톡 나에게 보내기 발송 실패: ${JSON.stringify(json)}`);
  }
}
