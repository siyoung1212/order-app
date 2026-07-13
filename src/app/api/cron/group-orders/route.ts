import { NextRequest, NextResponse } from "next/server";
import {
  getPendingOrderRequests,
  getHistoricalOrderRequestsForProduct,
  getProductsByStore,
  getVendors,
  createDailyOrder,
  updateOrderRequestStatus,
  type OrderRequestRecord,
  type Product,
  type Vendor,
} from "@/lib/notion";
import { notifyJohn } from "@/lib/notify";
import { sendKakaoTextToJohn } from "@/lib/kakao";

// ── 이 라우트는 매일 23:00 Make.com 스케줄러가 호출합니다. ──
// 흐름: 대기중인 오늘자 발주요청 조회 → 상품→거래처 관계로 그룹핑
//      → 상품별 최근 2~4주 평균 대비 이상치 탐지(경고만, 차단 없음)
//      → 거래처별 텍스트 요약 생성 → DAILY_ORDERS 저장
//      → 처리된 ORDER_REQUESTS를 "그룹핑완료"로 업데이트

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // Asia/Seoul = UTC+9 (DST 없음)
const HISTORY_DAYS = 28; // 이상치 비교 기준: 최근 4주
const MIN_HISTORY_DAYS = 3; // 이 미만이면 데이터 부족으로 판단, 플래그하지 않음
const ANOMALY_MULTIPLIER = 2; // 평균 대비 이 배수 이상이면 이상치

// 주어진 UTC 시각 기준, 그 시각이 속한 "KST 하루"의 [시작, 끝) UTC ISO 문자열 반환
function getKstDayRangeUtcIso(reference: Date): { startIso: string; endIso: string; dateLabel: string } {
    const kstMs = reference.getTime() + KST_OFFSET_MS;
    const kstDate = new Date(kstMs);
    const y = kstDate.getUTCFullYear();
    const m = kstDate.getUTCMonth();
    const d = kstDate.getUTCDate();
    // KST 자정에 해당하는 UTC 시각 = KST 00:00 - 9h
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - KST_OFFSET_MS;
    const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
    const dateLabel = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return {
          startIso: new Date(startUtcMs).toISOString(),
          endIso: new Date(endUtcMs).toISOString(),
          dateLabel,
    };
}

type AnomalyInfo = { isAnomaly: boolean; ratio: number | null; avg: number | null; dataPoints: number };

async function detectAnomaly(
    productId: string,
    todayQty: number,
    todayStartIso: string
  ): Promise<AnomalyInfo> {
    const historyStart = new Date(new Date(todayStartIso).getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const historyRecords = await getHistoricalOrderRequestsForProduct(productId, historyStart, todayStartIso);

  // 날짜별로 묶어서 "하루 총 발주량" 목록을 만든다 (동일 상품이 하루 여러 번 발주될 수 있으므로)
  const byDay = new Map<string, number>();
    for (const r of historyRecords) {
          const day = r.requestedAt.slice(0, 10);
          byDay.set(day, (byDay.get(day) ?? 0) + r.qty);
    }
    const dataPoints = byDay.size;

  if (dataPoints < MIN_HISTORY_DAYS) {
        // 데이터 부족: 판단하지 않음 (플래그 안 함)
      return { isAnomaly: false, ratio: null, avg: null, dataPoints };
  }

  const total = Array.from(byDay.values()).reduce((a, b) => a + b, 0);
    const avg = total / dataPoints;
    const ratio = avg > 0 ? todayQty / avg : null;
    const isAnomaly = avg > 0 && todayQty >= ANOMALY_MULTIPLIER * avg;
    return { isAnomaly, ratio, avg, dataPoints };
}

async function sendConfirmNotification(dateLabel: string, results: any[]): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL ?? "";
  const confirmToken = process.env.CONFIRM_ACCESS_TOKEN ?? "";
  const confirmUrl = baseUrl && confirmToken ? `${baseUrl}/confirm/${confirmToken}` : "";
  const vendorNames = results.map((r) => r.vendorName).join(", ");
  const anomalyCount = results.filter((r) => r.anomalies?.length > 0).length;
  const anomalyNote = anomalyCount > 0 ? ` (⚠이상치 ${anomalyCount}건)` : "";
  const kakaoText = `${dateLabel} 발주서 ${results.length}건 생성됨${anomalyNote}\n거래처: ${vendorNames}`;
  try {
    if (!confirmUrl) throw new Error("APP_BASE_URL 또는 CONFIRM_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.");
    await sendKakaoTextToJohn({ text: kakaoText, webUrl: confirmUrl, buttonTitle: "발주서 확인하기" });
  } catch (err: any) {
    console.error("kakao notify error, falling back to email", err);
    const lines = results.map((r) => {
      const anomalyMark = r.anomalies?.length > 0 ? " ⚠이상치 포함" : "";
      return `- ${r.vendorName}${anomalyMark}\n${r.summary}`;
    });
    const fallbackText = [
      `[카카오톡 발송 실패: ${err?.message ?? err}]`,
      "",
      `${dateLabel} 발주서 ${results.length}건이 생성되었습니다.`,
      confirmUrl ? `승인 페이지: ${confirmUrl}` : "(APP_BASE_URL/CONFIRM_ACCESS_TOKEN 미설정)",
      "",
      ...lines,
    ].filter(Boolean).join("\n\n");
    await notifyJohn(`[발주 확인 필요] ${dateLabel} 발주서 ${results.length}건`, fallbackText).catch((e) => console.error("email fallback also failed", e));
  }
}

export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || auth !== expected) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  try {
        const { startIso, endIso, dateLabel } = getKstDayRangeUtcIso(new Date());

      const [pending, products, vendors] = await Promise.all([
              getPendingOrderRequests(startIso, endIso),
              getProductsByStore(""),
              getVendors(),
            ]);

      const productById = new Map<string, Product>(products.map((p) => [p.id, p]));
        const vendorById = new Map<string, Vendor>(vendors.map((v) => [v.id, v]));

      // 거래처별로 그룹핑 (product → vendor 관계를 통해)
      type GroupEntry = { requests: OrderRequestRecord[]; qtyByProduct: Map<string, number> };
        const groups = new Map<string, GroupEntry>(); // vendorId -> entry
      const skipped: string[] = [];

      for (const req of pending) {
              const product = req.productId ? productById.get(req.productId) : null;
              if (!product || !product.vendorId) {
                        skipped.push(req.id);
                        continue;
              }
              if (!groups.has(product.vendorId)) {
                        groups.set(product.vendorId, { requests: [], qtyByProduct: new Map() });
              }
              const entry = groups.get(product.vendorId)!;
              entry.requests.push(req);
              entry.qtyByProduct.set(product.id, (entry.qtyByProduct.get(product.id) ?? 0) + req.qty);
      }

      const results: any[] = [];

      for (const [vendorId, entry] of groups) {
              const vendor = vendorById.get(vendorId);
              const vendorName = vendor?.name ?? "(알 수 없음)";

          const items: { description: string; qty: number; unitprice: number }[] = [];
              const anomalies: { product: string; ratio: number | null; avg: number | null }[] = [];

          for (const [productId, qty] of entry.qtyByProduct) {
                    const product = productById.get(productId)!;
                    const anomaly = await detectAnomaly(productId, qty, startIso);
                    let description = `${product.name}(${product.unit})`;
                    if (anomaly.isAnomaly) {
                                const ratioLabel = anomaly.ratio ? anomaly.ratio.toFixed(1) : "?";
                                description += ` ⚠이상치: 평균 대비 ${ratioLabel}배`;
                                anomalies.push({ product: product.name, ratio: anomaly.ratio, avg: anomaly.avg });
                    }
                    items.push({ description, qty, unitprice: product.price });
          }

          const summary = items.map((it) => `- ${it.description} x${it.qty}`).join("\n");
          const dailyOrderId = await createDailyOrder({
                    idLabel: `DO-${dateLabel}-${vendorName}`,
                    vendorId,
                    orderDateIso: dateLabel,
                    summary,
                    hasAnomaly: anomalies.length > 0,
          });

          for (const req of entry.requests) {
                    await updateOrderRequestStatus(req.id, "그룹핑완료");
          }

          results.push({
                    vendorId,
                    vendorName,
                    itemCount: items.length,
                    requestCount: entry.requests.length,
                    anomalies,
                    summary,
                    dailyOrderId,
          });
      }

      if (results.length > 0) {
              await sendConfirmNotification(dateLabel, results).catch((err) => {
                  console.error("confirm notification error", err);
              });
      }

      return NextResponse.json({
              ok: true,
              date: dateLabel,
              vendorsProcessed: results.length,
              skippedRequests: skipped,
              results,
      });
  } catch (err: any) {
        console.error("group-orders error", err);
        return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
