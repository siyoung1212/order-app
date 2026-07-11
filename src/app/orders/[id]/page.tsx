import { getDailyOrderById, getVendorById } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function OrderApprovalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getDailyOrderById(id).catch(() => null);

  if (!order) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-lg font-bold">발주서를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray-500 mt-2">링크가 올바른지 확인해주세요.</p>
      </main>
    );
  }

  const vendor = order.vendorId ? await getVendorById(order.vendorId).catch(() => null) : null;
  const isPending = order.approvalStatus === "대기";

  return (
    <main className="max-w-md mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">{vendor?.name ?? "거래처"} 발주서</h1>
        <p className="text-sm text-gray-500">{order.orderDate}</p>
      </div>

      {order.hasAnomaly && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-lg p-3">
          ⚠ 평소 대비 급증한 품목이 포함되어 있습니다. PDF에서 확인해주세요.
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">품목</p>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.summary || "-"}</p>
      </div>

      <a
        href={order.pdfUrl}
        target="_blank"
        rel="noreferrer"
        className="block text-center border rounded-lg py-2 text-sm font-medium text-blue-600 border-blue-300 hover:bg-blue-50"
      >
        발주서 PDF 열기
      </a>

      {isPending ? (
        <div className="flex gap-3 pt-2">
          <form action={`/api/orders/${id}/approve`} method="POST" className="flex-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-green-600 text-white py-3 text-sm font-semibold hover:bg-green-700"
            >
              승인 (거래처 발송)
            </button>
          </form>
          <form action={`/api/orders/${id}/reject`} method="POST" className="flex-1">
            <button
              type="submit"
              className="w-full rounded-lg bg-red-50 text-red-600 border border-red-300 py-3 text-sm font-semibold hover:bg-red-100"
            >
              반려
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-lg border p-4 text-sm space-y-1">
          <p>
            승인 상태: <span className="font-semibold">{order.approvalStatus}</span>
          </p>
          <p>
            발송 상태: <span className="font-semibold">{order.sendStatus}</span>
            {order.sendError && (
              <span className="block text-red-600 mt-1">오류: {order.sendError}</span>
            )}
          </p>
        </div>
      )}
    </main>
  );
}
