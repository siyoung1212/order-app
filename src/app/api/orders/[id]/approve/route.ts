import { NextRequest, NextResponse } from "next/server";
import { getDailyOrderById, updateDailyOrderApproval, markDispatchPending } from "@/lib/notion";
// import { dispatchDailyOrder } from "@/lib/dispatch"; // 사업자 인증(알리고 등) 완료 후 아래에서 다시 사용

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getDailyOrderById(id).catch(() => null);
  if (order && order.approvalStatus === "대기") {
    await updateDailyOrderApproval(id, "승인");
    // 거래처 발송(문자/이메일/카카오 알림톡)은 아직 연결하지 않았습니다.
    // 알리고 SMS 등 사업자 인증이 끝나면, 아래 두 줄을 교체하세요:
    //   await markDispatchPending(id);
    //   →
    //   await dispatchDailyOrder(id).catch((err) => console.error("dispatch error", err));
    // dispatch.ts / sms.ts / notify.ts 는 이미 구현되어 있으므로 이 한 줄만 바꾸면 됩니다.
    await markDispatchPending(id).catch((err) => console.error("markDispatchPending error", err));
  }
  const back = req.nextUrl.searchParams.get("back");
  const redirectPath = back && back.startsWith("/") ? back : `/orders/${id}`;
  const url = new URL(redirectPath, req.url);
  return NextResponse.redirect(url, { status: 303 });
}
