"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
  imageUrl: string;
};

type CartMap = Record<string, number>; // productId -> qty

export default function CatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("전체");
  const [cart, setCart] = useState<CartMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => {
        if (r.status === 401) {
          router.push("/login");
          return { products: [] };
        }
        return r.json();
      })
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setError("상품 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [router]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["전체", ...Array.from(set)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (activeCategory === "전체") return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [productId, qty]) => {
      const p = products.find((x) => x.id === productId);
      return sum + (p ? p.price * qty : 0);
    }, 0);
  }, [cart, products]);

  function updateQty(productId: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev };
      const current = next[productId] ?? 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        delete next[productId];
      } else {
        next[productId] = updated;
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (cartCount === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const items = Object.entries(cart).map(([productId, qty]) => ({
        productId,
        qty,
      }));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "발주 제출에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      router.push("/order/complete");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-500">
        불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold">발주하기</h1>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className="text-sm text-red-600 text-center py-2">{error}</p>
      )}

      {visibleProducts.length === 0 ? (
        <p className="text-center text-gray-400 py-16">
          등록된 상품이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {visibleProducts.map((product) => {
            const qty = cart[product.id] ?? 0;
            return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-gray-100">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      NO IMAGE
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1 flex-1">
                  <p className="text-sm font-medium line-clamp-1">
                    {product.name}
                  </p>
                  <p className="text-xs text-gray-400">{product.unit}</p>
                  <p className="text-sm font-bold mt-1">
                    {product.price.toLocaleString()}원
                  </p>

                  <div className="mt-auto pt-2 flex items-center justify-between">
                    {qty === 0 ? (
                      <button
                        onClick={() => updateQty(product.id, 1)}
                        className="w-full bg-gray-100 text-sm font-medium rounded-lg py-2"
                      >
                        담기
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-between bg-gray-100 rounded-lg">
                        <button
                          onClick={() => updateQty(product.id, -1)}
                          className="px-3 py-2 text-lg font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm font-medium">{qty}</span>
                        <button
                          onClick={() => updateQty(product.id, 1)}
                          className="px-3 py-2 text-lg font-bold"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
            <span>담은 상품 {cartCount}개</span>
            <span className="font-bold text-black">
              {cartTotal.toLocaleString()}원
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-black text-white rounded-lg py-3 font-medium disabled:opacity-50"
          >
            {submitting ? "제출 중..." : "발주 제출"}
          </button>
        </div>
      )}
    </main>
  );
}
