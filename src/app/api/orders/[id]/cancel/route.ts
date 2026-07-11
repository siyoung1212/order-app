import { NextRequest, NextResponse } from "next/server";
import { getDailyOrderById, cancelDailyOrderApproval } from "@/lib/notion";

export async function POST(
    req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
    const order = await getDailyOrderById(id).catch(() => null);

  if (order && order.approvalStatus === "승인") {
        await cancelDailyOrderApproval(id);
  }

  const back = req.nextUrl.searchParams.get("back");
    const redirectPath = back && back.startsWith("/") ? back : `/orders/${id}`;
    const url = new URL(redirectPath, req.url);
    return NextResponse.redirect(url, { status: 303 });
}
