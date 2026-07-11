import { sendSms } from "./sms";
import { sendEmail, notifyJohn } from "./notify";
import {
  getDailyOrderById,
  getVendorById,
  updateDailyOrderSendResult,
  type DailyOrder,
  type Vendor,
} from "./notion";

// 거래처 채널에 따라 문자/이메일로 발송합니다.
// 주의: VENDORS.channel="카카오톡"인 거래처는 카카오 알림톡(사업자 인증 필요)이
// 아직 구축되지 않아, 당분간 문자(SMS)로 대체 발송합니다.
export async function dispatchDailyOrder(dailyOrderId: string): Promise<void> {
  const order = await getDailyOrderById(dailyOrderId);
  if (!order) throw new Error(`DAILY_ORDERS 페이지를 찾을 수 없습니다: ${dailyOrderId}`);
  if (!order.vendorId) throw new Error("거래처 정보가 없는 발주서입니다.");

  const vendor = await getVendorById(order.vendorId);
  if (!vendor) throw new Error(`거래처 정보를 찾을 수 없습니다: ${order.vendorId}`);

  try {
    await sendToVendor(order, vendor);
    await updateDailyOrderSendResult(dailyOrderId, {
      status: "발송완료",
      sentAtIso: new Date().toISOString(),
    });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    await updateDailyOrderSendResult(dailyOrderId, { status: "대기", error: message });
    // John에게 실패 알림 (실패해도 메인 흐름은 막지 않음)
    await notifyJohn(
      `[발주 발송 실패] ${vendor.name}`,
      `${vendor.name} 거래처로 발주서 발송에 실패했습니다.\n\n오류: ${message}\n\nNotion에서 수동으로 확인해주세요.\nPDF: ${order.pdfUrl}`
    ).catch(() => {
      // 알림 발송 자체가 실패해도 원래 에러를 삼키지 않도록 무시
    });
    throw err;
  }
}

async function sendToVendor(order: DailyOrder, vendor: Vendor): Promise<void> {
  const message = buildMessage(order, vendor);

  if (vendor.channel === "이메일") {
    if (!vendor.contact || !vendor.contact.includes("@")) {
      throw new Error(`거래처 이메일 주소가 올바르지 않습니다: "${vendor.contact}"`);
    }
    await sendEmail({
      to: vendor.contact,
      subject: `[발주서] ${vendor.name} - ${order.orderDate}`,
      text: message,
    });
    return;
  }

  // "문자" 및 "카카오톡"(알림톡 미구축으로 임시 대체) 모두 SMS로 발송
  if (!vendor.contact) {
    throw new Error("거래처 연락처(전화번호)가 비어 있습니다.");
  }
  await sendSms({ to: vendor.contact, message });
}

function buildMessage(order: DailyOrder, vendor: Vendor): string {
  const anomalyNote = order.hasAnomaly ? "\n⚠ 이상 수량 품목 포함 (평소 대비 급증)" : "";
  return [
    `[발주서] ${vendor.name}`,
    `날짜: ${order.orderDate}`,
    order.summary ? `품목: ${order.summary}` : "",
    anomalyNote,
    `PDF: ${order.pdfUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}
