/**
 * 직원 PIN을 해시해서 노션 EMPLOYEES.pin_hash에 채워 넣는 스크립트.
 * 새 직원을 등록하거나 PIN을 초기화할 때 사용하세요.
 *
 * 실행 전 .env.local에 NOTION_API_KEY, NOTION_EMPLOYEES_DATA_SOURCE_ID를 설정하세요.
 * 실행: npx tsx scripts/seed-pins.ts
 *
 * 아래 PINS 맵을 실제 배정할 이름/PIN으로 수정한 뒤 실행하세요.
 */
import "dotenv/config";
import { Client } from "@notionhq/client";
import bcrypt from "bcryptjs";

const PINS: Record<string, string> = {
  김철수: "1234",
  이영희: "5678",
  // "새직원이름": "0000",
};

async function main() {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const dataSourceId = process.env.NOTION_EMPLOYEES_DATA_SOURCE_ID!;

  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: 100,
  });

  for (const page of res.results as any[]) {
    const name = page.properties?.name?.title?.[0]?.plain_text;
    const pin = PINS[name];
    if (!pin) continue;

    const hash = await bcrypt.hash(pin, 10);
    await notion.pages.update({
      page_id: page.id,
      properties: {
        pin_hash: { rich_text: [{ text: { content: hash } }] },
      } as any,
    });
    console.log(`✔ ${name} PIN 설정 완료`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
