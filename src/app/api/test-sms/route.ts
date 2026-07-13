import { NextResponse } from "next/server";
import { sendSms } from "@/lib/sms";

export async function GET() {
  try {
    await sendSms({
      to: "010-8588-6570",
      message: "[발주 자동화] 문자 발송 테스트입니다. 이 문자가 보이면 SMS 연동이 정상 작동 중입니다.",
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

