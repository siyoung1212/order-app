import Link from "next/link";

export default function OrderCompletePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-lg font-bold mb-2">발주가 접수되었습니다</h1>
        <p className="text-sm text-gray-500 mb-6">
          담당자 확인 후 거래처로 발주가 진행됩니다.
        </p>
        <Link
          href="/catalog"
          className="block w-full bg-black text-white rounded-lg py-3 font-medium"
        >
          계속 발주하기
        </Link>
      </div>
    </main>
  );
}
