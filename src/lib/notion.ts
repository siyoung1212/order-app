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


    // ---- VENDORS ----
export type Vendor = {
    id: string;
    name: string;
    channel: string;
    contact: string;
};

export async function getVendors(): Promise<Vendor[]> {
    const res = await notion.dataSources.query({
          data_source_id: DATA_SOURCE.vendors,
          page_size: 100,
    });
    return res.results.map((page: any) => ({
          id: page.id,
          name: getTitle(page.properties, "name"),
          channel: getSelect(page.properties, "channel"),
          contact: getRichText(page.properties, "contact"),
    }));
}

// ---- ORDER_REQUESTS 조회 (자동화 엔진용) ----
export type OrderRequestRecord = {
    id: string; // 노션 페이지 ID
    productId: string | null;
    employeeId: string | null;
    qty: number;
    status: string;
    requestedAt: string;
};

function parseOrderRequestPage(page: any): OrderRequestRecord {
    return {
          id: page.id,
          productId: getRelationFirstId(page.properties, "product"),
          employeeId: getRelationFirstId(page.properties, "employee"),
          qty: getNumber(page.properties, "qty"),
          status: getSelect(page.properties, "status"),
          requestedAt: page.properties?.requested_at?.created_time ?? page.created_time,
    };
}

// status="대기"이며 requestedAt이 [startIso, endIso) 범위인 발주요청 조회
export async function getPendingOrderRequests(
    startIso: string,
    endIso: string
  ): Promise<OrderRequestRecord[]> {
    const res = await notion.dataSources.query({
          data_source_id: DATA_SOURCE.orderRequests,
          filter: {
                  and: [
                    { property: "status", select: { equals: "대기" } },
                    { property: "requested_at", created_time: { on_or_after: startIso } },
                    { property: "requested_at", created_time: { before: endIso } },
                          ],
          } as any,
          page_size: 100,
    });
    return res.results.map(parseOrderRequestPage);
}

// 특정 상품의 과거 발주요청(상태 무관) 조회 — 이상치 탐지용
export async function getHistoricalOrderRequestsForProduct(
    productId: string,
    startIso: string,
    endIso: string
  ): Promise<OrderRequestRecord[]> {
    const res = await notion.dataSources.query({
          data_source_id: DATA_SOURCE.orderRequests,
          filter: {
                  and: [
                    { property: "product", relation: { contains: productId } },
                    { property: "requested_at", created_time: { on_or_after: startIso } },
                    { property: "requested_at", created_time: { before: endIso } },
                          ],
          } as any,
          page_size: 100,
    });
    return res.results.map(parseOrderRequestPage);
}

export async function updateOrderRequestStatus(
    pageId: string,
    status: string
  ): Promise<void> {
    await notion.pages.update({
          page_id: pageId,
          properties: {
                  status: { select: { name: status } },
          } as any,
    });
}

// ---- DAILY_ORDERS 생성 ----
export async function createDailyOrder(params: {
  idLabel: string;
  vendorId: string;
  orderDateIso: string; // YYYY-MM-DD
  pdfUrl: string;
  summary?: string;
  hasAnomaly?: boolean;
}): Promise<string> {
  const page = await notion.pages.create({
    parent: { data_source_id: DATA_SOURCE.dailyOrders } as any,
    properties: {
      id: { title: [{ text: { content: params.idLabel } }] },
      vendor: { relation: [{ id: params.vendorId }] },
      order_date: { date: { start: params.orderDateIso } },
      pdf_url: { rich_text: [{ text: { content: params.pdfUrl } }] },
      approval_status: { select: { name: "대기" } },
      send_status: { select: { name: "대기" } },
      summary: { rich_text: params.summary ? [{ text: { content: params.summary.slice(0, 1900) } }] : [] },
      has_anomaly: { checkbox: !!params.hasAnomaly },
    } as any,
  });
  return page.id;
}

// ---- DAILY_ORDERS 조회/업데이트 (컨펌+발송용) ----
export type DailyOrder = {
  id: string; // 노션 페이지 ID
  idLabel: string;
  vendorId: string | null;
  orderDate: string;
  pdfUrl: string;
  approvalStatus: string;
  sendStatus: string;
  summary: string;
  hasAnomaly: boolean;
  sentAt: string;
  sendError: string;
};

function parseDailyOrderPage(page: any): DailyOrder {
  return {
    id: page.id,
    idLabel: getTitle(page.properties, "id"),
    vendorId: getRelationFirstId(page.properties, "vendor"),
    orderDate: page.properties?.order_date?.date?.start ?? "",
    pdfUrl: getRichText(page.properties, "pdf_url"),
    approvalStatus: getSelect(page.properties, "approval_status"),
    sendStatus: getSelect(page.properties, "send_status"),
    summary: getRichText(page.properties, "summary"),
    hasAnomaly: page.properties?.has_anomaly?.checkbox ?? false,
    sentAt: page.properties?.sent_at?.date?.start ?? "",
    sendError: getRichText(page.properties, "send_error"),
  };
}

export async function getDailyOrderById(pageId: string): Promise<DailyOrder | null> {
  const page: any = await notion.pages.retrieve({ page_id: pageId });
  if (!page || page.archived) return null;
  return parseDailyOrderPage(page);
}

export async function getVendorById(vendorId: string): Promise<Vendor | null> {
  const page: any = await notion.pages.retrieve({ page_id: vendorId });
  if (!page || page.archived) return null;
  return {
    id: page.id,
    name: getTitle(page.properties, "name"),
    channel: getSelect(page.properties, "channel"),
    contact: getRichText(page.properties, "contact"),
  };
}

export async function updateDailyOrderApproval(
  pageId: string,
  status: "승인" | "반려"
): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      approval_status: { select: { name: status } },
    } as any,
  });
}

export async function updateDailyOrderSendResult(
  pageId: string,
  params: { status: "발송완료" | "대기"; sentAtIso?: string; error?: string }
): Promise<void> {
  const properties: any = {
    send_status: { select: { name: params.status } },
  };
  if (params.sentAtIso) {
    properties.sent_at = { date: { start: params.sentAtIso } };
  }
  properties.send_error = {
    rich_text: params.error ? [{ text: { content: params.error.slice(0, 1900) } }] : [],
  };
  await notion.pages.update({ page_id: pageId, properties });
}
