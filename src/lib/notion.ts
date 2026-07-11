import { Client } from "@notionhq/client";

// ---- Notion 클라이언트 & 데이터소스 ID ----
// .env.local (또는 Vercel 환경변수)에 아래 값들을 설정하세요.
export const notion = new Client({ auth: process.env.NOTION_API_KEY });

export const DATA_SOURCE = {
  employees: process.env.NOTION_EMPLOYEES_DATA_SOURCE_ID!,
  vendors: process.env.NOTION_VENDORS_DATA_SOURCE_ID!,
  products: process.env.NOTION_PRODUCTS_DATA_SOURCE_ID!,
  orderRequests: process.env.NOTION_ORDER_REQUESTS_DATA_SOURCE_ID!,
  dailyOrders: process.env.NOTION_DAILY_ORDERS_DATA_SOURCE_ID!,
};

// ---- 타입 ----
export type Employee = {
  id: string;
  name: string;
  pinHash: string;
  store: string;
  role: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
  imageUrl: string;
  vendorId: string | null;
};

// ---- 속성 파서 헬퍼 ----
function getTitle(props: any, key: string): string {
  return props[key]?.title?.[0]?.plain_text ?? "";
}
function getRichText(props: any, key: string): string {
  return props[key]?.rich_text?.[0]?.plain_text ?? "";
}
function getSelect(props: any, key: string): string {
  return props[key]?.select?.name ?? "";
}
function getNumber(props: any, key: string): number {
  return props[key]?.number ?? 0;
}
function getRelationFirstId(props: any, key: string): string | null {
  return props[key]?.relation?.[0]?.id ?? null;
}

// ---- EMPLOYEES ----
export async function getEmployees(): Promise<Employee[]> {
  const res = await notion.dataSources.query({
    data_source_id: DATA_SOURCE.employees,
    page_size: 100,
  });
  return res.results.map((page: any) => ({
    id: page.id,
    name: getTitle(page.properties, "name"),
    pinHash: getRichText(page.properties, "pin_hash"),
    store: getSelect(page.properties, "store"),
    role: getSelect(page.properties, "role"),
  }));
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const page: any = await notion.pages.retrieve({ page_id: id });
  if (!page || page.archived) return null;
  return {
    id: page.id,
    name: getTitle(page.properties, "name"),
    pinHash: getRichText(page.properties, "pin_hash"),
    store: getSelect(page.properties, "store"),
    role: getSelect(page.properties, "role"),
  };
}

// ---- PRODUCTS ----
export async function getProductsByStore(_store: string): Promise<Product[]> {
  // 현재 PRODUCTS DB에는 매장을 구분하는 속성이 없어 전체 상품을 반환합니다.
  // 매장별로 취급 상품이 달라지면 PRODUCTS DB에 store(multi-select) 속성을
  // 추가하고 이 함수에서 필터링하도록 확장하세요.
  const res = await notion.dataSources.query({
    data_source_id: DATA_SOURCE.products,
    page_size: 100,
  });
  return res.results.map((page: any) => ({
    id: page.id,
    name: getTitle(page.properties, "name"),
    price: getNumber(page.properties, "price"),
    unit: getRichText(page.properties, "unit"),
    category: getSelect(page.properties, "category"),
    imageUrl: getRichText(page.properties, "image_url"),
    vendorId: getRelationFirstId(page.properties, "vendor"),
  }));
}

// ---- ORDER_REQUESTS ----
export type CartItem = {
  productId: string;
  qty: number;
};

export async function createOrderRequests(
  employeeId: string,
  items: CartItem[]
): Promise<string[]> {
  const createdIds: string[] = [];
  // Notion API는 페이지를 한 번에 하나씩 생성해야 하므로 순차 처리합니다.
  for (const item of items) {
    const idLabel = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const page = await notion.pages.create({
      parent: { data_source_id: DATA_SOURCE.orderRequests } as any,
      properties: {
        id: { title: [{ text: { content: idLabel } }] },
        employee: { relation: [{ id: employeeId }] },
        product: { relation: [{ id: item.productId }] },
        qty: { number: item.qty },
        status: { select: { name: "대기" } },
      } as any,
    });
    createdIds.push(page.id);
  }
  return createdIds;
}
