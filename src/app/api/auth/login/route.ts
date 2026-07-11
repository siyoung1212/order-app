import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getEmployeeById } from "@/lib/notion";
import { createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { employeeId, pin } = await req.json();

    if (!employeeId || !pin || typeof pin !== "string" || pin.length !== 4) {
      return NextResponse.json(
        { error: "직원을 선택하고 4자리 PIN을 입력하세요." },
        { status: 400 }
      );
    }

    const employee = await getEmployeeById(employeeId);
    if (!employee || !employee.pinHash) {
      return NextResponse.json(
        { error: "직원 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const isValid = await bcrypt.compare(pin, employee.pinHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "PIN이 일치하지 않습니다." },
        { status: 401 }
      );
    }

    await createSession({
      employeeId: employee.id,
      name: employee.name,
      store: employee.store,
      role: employee.role,
    });

    return NextResponse.json({
      ok: true,
      employee: { name: employee.name, store: employee.store, role: employee.role },
    });
  } catch (err: any) {
    console.error("POST /api/auth/login failed", err);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
