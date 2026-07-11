import { getDailyOrdersByDate, getVendorById } from "@/lib/notion";

export const dynamic = "force-dynamic";

function todayKstDateLabel(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstMs = Date.now() + KST_OFFSET_MS;
  const kstDate = new Date(kstMs);
  const y = kstDate.getUTCFullYear();
  const m = kstDate.getUTCMonth();
  const d = kstDate.getUTCDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function statusBadgeClass(status: string): string {
  if (status === "승인") return "bg-green-100 text-green-700";
  if (status === "반려") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

export default async function ConfirmListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const expected = process.env.CONFIRM_ACCESS_TOKEN;

  if (!expected || token !== expected) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-lg font-bold">페이지를 찾을 수 없습니다</h1>
      </main>
    );
  }

  const dateLabel = todayKstDateLabel();
  const orders = await getDailyOrdersByDate(dateLabel).catch(() => []);

  const ordersWithVendor = await Promise.all(
    orders.map(async (order) => {
      const vendor = order.vendorId ? await getVendorById(order.vendorId).catch(() => null) : null;
      return { order, vendor };
    })
  );

  const backParam = `?back=${encodeURIComponent(`/confirm/${token}`)}`;

  return (
    <main className="max-w-md mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">{dateLabel} 발주서 확인</h1>
        <p className="text-sm text-gray-500">총 {ordersWithVendor.length}건</p>
      </div>

      {ordersWithVendor.length === 0 && (
        <p className="text-sm text-gray-500">오늘 생성된 발주서가 없습니다.</p>
      )}

      <div className="space-y-4">
        {ordersWithVendor.map(({ order, vendor }) => {
          const isPending = order.approvalStatus === "대기";
          const isApproved = order.approvalStatus === "승인";
          const isRejected = order.approvalStatus === "반려";
          return (
            <div key={order.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{vendor?.name ?? "거래처"}</h2>
                <span className={`text-xs rounded-full px-2 py-1 font-medium ${statusBadgeClass(order.approvalStatus)}`}>
                  {order.approvalStatus}
                </span>
              </div>

              {order.hasAnomaly && (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-lg p-2">
                  ⚠ 평소 대비 급증한 품목이 포함되어 있습니다.
                </div>
              )}

              <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.summary || "-"}</p>

              <a
                href={order.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-center border rounded-lg py-2 text-sm font-medium text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                발주서 PDF 열기
              </a>

              {isPending && (
                <div className="flex gap-3 pt-1">
                  <form action={`/api/orders/${order.id}/approve${backParam}`} method="POST" className="flex-1">
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-green-600 text-white py-2 text-sm font-semibold hover:bg-green-700"
                    >
                      승인
                    </button>
                  </form>
                  <form action={`/api/orders/${order.id}/reject${backParam}`} method="POST" className="flex-1">
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-red-50 text-red-600 border border-red-300 py-2 text-sm font-semibold hover:bg-red-100"
                    >
                      반려
                    </button>
                  </form>
                </div>
              )}

              {isApproved && (
                <div className="space-y-2 pt-1">
                  <div className="text-sm space-y-1">
                    <p>
                      발송 상태: <span className="font-semibold">{order.sendStatus}</span>
                    </p>
                    {order.sendError && (
                      <p className="text-red-600">오류: {order.sendError}</p>
                    )}
                  </div>
                  <form action={`/api/orders/${order.id}/cancel${backParam}`} method="POST">
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-gray-100 text-gray-600 border border-gray-300 py-2 text-sm font-semibold hover:bg-gray-200"
                    >
                      승인 취소
                    </button>
                  </form>
                </div>
              )}

              {isRejected && (
                <p className="text-sm text-gray-500 pt-1">반려된 발주서입니다.</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
