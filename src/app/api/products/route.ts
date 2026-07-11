import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProductsByStore } from "@/lib/notion";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const products = await getProductsByStore(session.store);
    return NextResponse.json({ products });
  } catch (err: any) {
    console.error("GET /api/products failed", err);
    return NextResponse.json(
      { error: "상품 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
