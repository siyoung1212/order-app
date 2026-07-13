import { ProxyAgent, setGlobalDispatcher } from "undici";

// QuotaGuard 등 고정 아웃바운드 IP 프록시를 사용 중이면 모든 fetch 요청이 해당 프록시를 거치도록 설정합니다.
// 알리고(Aligo)는 발송 서버의 고정 IP를 사전 등록해야 하므로, Vercel 서버리스 함수의 유동 IP 대신
// 프록시의 고정 IP를 사용하기 위함입니다. QUOTAGUARDSTATIC_URL이 설정되지 않았다면 아무 동작도 하지 않습니다.
let proxyConfigured = false;
function ensureProxyConfigured(): void {
  if (proxyConfigured) return;
  proxyConfigured = true;
  const proxyUrl = process.env.QUOTAGUARDSTATIC_URL;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }
}

// ---- SMS 발송 (알리고 Aligo API) ----
// 환경변수: ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER(사전등록된 발신번호)
// 참고: https://smartsms.aligo.in/admin/api/spec.html

export async function sendSms(params: { to: string; message: string }): Promise<void> {
  ensureProxyConfigured();
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;
  if (!apiKey || !userId || !sender) {
    throw new Error("ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER 환경변수가 설정되지 않았습니다.");
  }

  const body = new URLSearchParams({
    key: apiKey,
    user_id: userId,
    sender,
    receiver: params.to.replace(/-/g, ""),
    msg: params.message,
    // 90byte(한글 45자) 초과 시 자동으로 LMS 처리되도록 msg_type 생략
  });

  const res = await fetch("https://apis.aligo.in/send/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`알리고 SMS API 오류 (${res.status}): ${text}`);
  }

  const json: any = await res.json();
  // result_code: 1 = 성공, 그 외(음수) = 실패
  if (json.result_code !== 1) {
    throw new Error(`알리고 SMS 발송 실패: ${JSON.stringify(json)}`);
  }
}
