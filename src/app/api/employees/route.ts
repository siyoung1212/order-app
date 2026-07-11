import { NextResponse } from "next/server";
import { getEmployees } from "@/lib/notion";

// 로그인 화면에서 직원 목록(이름만)을 드롭다운으로 보여주기 위한 API.
// PIN 해시는 절대 클라이언트로 내려보내지 않는다.
export async function GET() {
  try {
    const employees = await getEmployees();
    const safeList = employees.map((e) => ({
      id: e.id,
      name: e.name,
      store: e.store,
    }));
    return NextResponse.json({ employees: safeList });
  } catch (err: any) {
    console.error("GET /api/employees failed", err);
    return NextResponse.json(
      { error: "직원 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
