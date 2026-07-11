import { NextRequest, NextResponse } from "next/server";
import { getDailyOrderById, updateDailyOrderApproval } from "@/lib/notion";
import { dispatchDailyOrder } from "@/lib/dispatch";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getDailyOrderById(id).catch(() => null);

  if (order && order.approvalStatus === "대기") {
    await updateDailyOrderApproval(id, "승인");
    // 승인 즉시 거래처로 발송 시도 (실패해도 승인 자체는 유지, 오류는 페이지에 표시됨)
    await dispatchDailyOrder(id).catch((err) => {
      console.error("dispatch error", err);
    });
  }

  const url = new URL(`/orders/${id}`, req.url);
  return NextResponse.redirect(url, { status: 303 });
}
