// 유휴 시간 기반 자동 로그아웃 - 순수 로직 (DOM/React에 의존하지 않음, 단위 테스트 용이)
//
// 기존 세션(절대 만료: JWT 12시간, src/lib/auth.ts)과는 완전히 별개로 동작하는
// "활동 없음" 감지 타이머입니다. 서버 세션 만료 로직은 건드리지 않습니다.

// 마지막 활동 후 이 시간(ms)이 지나면 로그아웃합니다.
export const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5분

// 로그아웃되기 이 시간(ms) 전부터 "곧 로그아웃됩니다" 경고를 보여줍니다.
// (요구사항: 30초~1분 전 경고) → 45초로 설정
export const WARNING_BEFORE_MS = 45 * 1000; // 45초

export type IdleState = {
  /** null이면 경고를 표시하지 않음. 숫자면 로그아웃까지 남은 ms (경고 표시). */
  remainingMs: number | null;
  /** true면 즉시 로그아웃 처리해야 함 */
  shouldLogout: boolean;
};

export type IdleControllerOptions = {
  idleLimitMs?: number;
  warningBeforeMs?: number;
  /** 테스트에서 가짜 시계를 주입하기 위한 옵션 */
  now?: () => number;
};

export function createIdleController(options: IdleControllerOptions = {}) {
  const idleLimitMs = options.idleLimitMs ?? IDLE_LIMIT_MS;
  const warningBeforeMs = options.warningBeforeMs ?? WARNING_BEFORE_MS;
  const now = options.now ?? Date.now;

  let lastActivityAt = now();
  let loggedOut = false;

  /**
   * 활동을 기록합니다. (다른 탭에서 전달된 타임스탬프일 수도 있음)
   * 과거 시각(현재 기록보다 이전)이 들어오면 무시합니다 - 역행 방지.
   */
  function recordActivity(at: number = now()) {
    if (at > lastActivityAt) {
      lastActivityAt = at;
    }
    loggedOut = false;
  }

  /** 강제로 마지막 활동 시각을 지정 시각으로 리셋 (역행 방지 없이) */
  function reset(at: number = now()) {
    lastActivityAt = at;
    loggedOut = false;
  }

  function markLoggedOut() {
    loggedOut = true;
  }

  function isLoggedOut() {
    return loggedOut;
  }

  function getLastActivity() {
    return lastActivityAt;
  }

  function evaluate(at: number = now()): IdleState {
    const elapsed = at - lastActivityAt;
    const remaining = idleLimitMs - elapsed;

    if (remaining <= 0) {
      return { remainingMs: 0, shouldLogout: true };
    }

    return {
      remainingMs: remaining <= warningBeforeMs ? remaining : null,
      shouldLogout: false,
    };
  }

  return {
    recordActivity,
    reset,
    evaluate,
    markLoggedOut,
    isLoggedOut,
    getLastActivity,
    idleLimitMs,
    warningBeforeMs,
  };
}
