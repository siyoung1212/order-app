"use client";

// 유휴 시간 기반 자동 로그아웃 가드
//
// - 마지막 활동(클릭/터치/스크롤/키 입력 등) 후 5분 동안 아무 활동이 없으면 자동 로그아웃
// - 로그아웃 45초 전부터 "곧 로그아웃됩니다" 경고를 띄우고, 활동이 감지되면 타이머 리셋
// - 여러 탭을 열어둔 경우: localStorage의 storage 이벤트로 활동 시각과 로그아웃 발생을
//   모든 탭에 동기화합니다 (탭마다 따로 도는 5분 타이머가 서로 어긋나지 않도록).
// - 실제 로그아웃 시 /api/auth/logout을 호출해 서버의 httpOnly 세션 쿠키(JWT)를
//   직접 무효화합니다. 화면 전환만 하고 토큰은 살아있는 상태가 되지 않도록 합니다.
// - 기존 세션 절대 만료(JWT 12시간, src/lib/auth.ts)와는 완전히 별개로 동작합니다.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createIdleController } from "@/lib/idle-controller";

const TICK_MS = 1000;
const STORAGE_ACTIVITY_KEY = "oa_idle_last_activity";
const STORAGE_LOGOUT_KEY = "oa_idle_logout_at";
const ACTIVITY_THROTTLE_MS = 1000; // localStorage 쓰기 과다 방지

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "click",
  "keydown",
  "touchstart",
  "scroll",
] as const;

// 이 가드가 활성화되는 경로 (로그인 화면 자체에는 적용하지 않음 - 세션이 없으므로 의미 없음)
const PROTECTED_PREFIXES = ["/catalog", "/order"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// 바깥쪽 컴포넌트: 경로가 바뀔 때마다 안쪽 컴포넌트를 key로 강제 재마운트한다.
// 이렇게 하면 "경로 진입 시 타이머를 새로 시작"하는 로직을 effect 안에서
// setState로 처리할 필요 없이, useState의 초기값(null)으로 자연스럽게 해결된다.
export default function IdleLogoutGuard() {
  const pathname = usePathname();
  if (!isProtectedPath(pathname)) return null;
  return <IdleLogoutGuardActive key={pathname} />;
}

function IdleLogoutGuardActive() {
  const router = useRouter();

  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const controllerRef = useRef<ReturnType<typeof createIdleController> | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createIdleController();
  }
  const lastWriteRef = useRef(0);
  const loggingOutRef = useRef(false);

  const doLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    controllerRef.current?.markLoggedOut();

    try {
      window.localStorage.setItem(STORAGE_LOGOUT_KEY, String(Date.now()));
    } catch {
      // localStorage 접근 실패(프라이빗 모드 등)해도 로그아웃 자체는 진행
    }

    try {
      // 서버 세션(httpOnly 쿠키) 무효화. 클라이언트 화면만 바뀌고 토큰이
      // 살아있는 상태를 방지하기 위해 반드시 서버 로그아웃을 먼저 호출한다.
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 네트워크 오류가 나더라도 사용자를 로그인 화면으로는 보낸다.
      // (다음 요청 시 proxy.ts가 세션을 다시 검증하므로 안전)
    }

    router.push("/login?reason=idle");
    router.refresh();
  }, [router]);

  const recordLocalActivity = useCallback((broadcast: boolean) => {
    const now = Date.now();
    controllerRef.current?.recordActivity(now);
    setRemainingMs(null);

    if (broadcast && now - lastWriteRef.current > ACTIVITY_THROTTLE_MS) {
      lastWriteRef.current = now;
      try {
        window.localStorage.setItem(STORAGE_ACTIVITY_KEY, String(now));
      } catch {
        // 무시 - localStorage를 못 쓰면 탭 간 동기화만 안 될 뿐, 이 탭 자체 타이머는 정상 동작
      }
    }
  }, []);

  useEffect(() => {
    const controller = controllerRef.current!;
    loggingOutRef.current = false;

    const handleActivity = () => recordLocalActivity(true);
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );

    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_ACTIVITY_KEY && e.newValue) {
        const ts = Number(e.newValue);
        if (!Number.isNaN(ts)) {
          controller.recordActivity(ts);
          setRemainingMs(null);
        }
      }
      if (e.key === STORAGE_LOGOUT_KEY && e.newValue) {
        // 다른 탭에서 유휴 로그아웃이 발생함 → 이 탭도 즉시 로그인 화면으로 이동
        // (서버 쿠키는 이미 그 탭에서 무효화했으므로 여기서는 화면만 전환)
        if (!loggingOutRef.current) {
          loggingOutRef.current = true;
          controller.markLoggedOut();
          router.push("/login?reason=idle");
          router.refresh();
        }
      }
    }
    window.addEventListener("storage", handleStorage);

    function tick() {
      if (loggingOutRef.current) return;
      const state = controller.evaluate();
      if (state.shouldLogout) {
        setRemainingMs(0);
        doLogout();
        return;
      }
      setRemainingMs(state.remainingMs);
    }

    function handleVisibility() {
      // 백그라운드 탭에서 돌아왔을 때 (모바일에서 setInterval이 쉬었을 수 있으므로)
      // 즉시 재평가해서 이미 유휴 시간이 지났으면 바로 로그아웃 처리한다.
      if (document.visibilityState === "visible") {
        tick();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = window.setInterval(tick, TICK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      );
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [recordLocalActivity, doLogout, router]);

  if (remainingMs === null) return null;

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-lg p-6 text-center">
        <p className="text-base font-bold mb-2">곧 로그아웃됩니다</p>
        <p className="text-sm text-gray-500 mb-4">
          {seconds}초 동안 활동이 없으면 자동으로 로그아웃됩니다.
          <br />
          담아둔 상품이 있다면 지금 조작해서 로그인 상태를 유지하세요.
        </p>
        <button
          type="button"
          onClick={() => recordLocalActivity(true)}
          className="w-full bg-black text-white rounded-lg py-3 font-medium"
        >
          계속 사용하기
        </button>
      </div>
    </div>
  );
}
