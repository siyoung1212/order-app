import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createOrderRequests } from "@/lib/notion";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "장바구니가 비어 있습니다." },
        { status: 400 }
      );
    }
    for (const item of items) {
      if (!item.productId || !Number.isFinite(item.qty) || item.qty <= 0) {
        return NextResponse.json(
          { error: "장바구니 항목이 올바르지 않습니다." },
          { status: 400 }
        );
      }
    }

    const createdIds = await createOrderRequests(session.employeeId, items);
    return NextResponse.json({ ok: true, createdIds });
  } catch (err: any) {
    console.error("POST /api/orders failed", err);
    return NextResponse.json(
      { error: "발주 제출 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
