import { NextRequest, NextResponse } from "next/server";
import { getDailyOrderById, updateDailyOrderApproval } from "@/lib/notion";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getDailyOrderById(id).catch(() => null);

  if (order && order.approvalStatus === "대기") {
    await updateDailyOrderApproval(id, "반려");
  }

  const url = new URL(`/orders/${id}`, req.url);
  return NextResponse.redirect(url, { status: 303 });
}
