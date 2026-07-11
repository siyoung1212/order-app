# 발주 시스템 웹앱

뼈다귀연구소 / 돈골 사골순대국밥 직원용 식자재 발주 웹앱입니다. Next.js(App Router)로 만들었고, 데이터는 전부 노션(EMPLOYEES/VENDORS/PRODUCTS/ORDER_REQUESTS/DAILY_ORDERS DB)에 저장됩니다.

## 1. 로컬 설정

```bash
npm install
cp .env.local.example .env.local
```

`.env.local`을 열어 아래 값을 채우세요.

- `NOTION_API_KEY`: Notion Integration Secret (`ntn_`로 시작). 발급/DB 연결 방법은 이전 단계 가이드(`노션_발주자동화_구축가이드.md`) 3~4번 참고.
- `NOTION_*_DATA_SOURCE_ID`: 이미 만들어둔 5개 DB의 데이터소스 ID입니다. `.env.local.example`에 실제 값이 이미 채워져 있으니 그대로 쓰면 됩니다.
- `SESSION_SECRET`: 로그인 세션(JWT) 서명에 쓰는 임의의 랜덤 문자열. `openssl rand -base64 32`로 생성하세요.

```bash
npm run dev
```

http://localhost:3000 접속 → 로그인 화면이 뜨면 정상입니다.

## 2. 로그인 테스트 계정

노션 EMPLOYEES DB에 미리 PIN을 넣어뒀습니다.

- 김철수 (뼈다귀연구소 / 직원) — PIN `1234`
- 이영희 (돈골 / 매니저) — PIN `5678`

새 직원을 추가하거나 PIN을 바꾸려면 `scripts/seed-pins.ts`의 `PINS` 객체를 수정한 뒤 아래 명령을 실행하세요.

```bash
npm run seed:pins
```

## 3. 화면 구성

- `/login`: 직원 선택 + PIN 4자리 입력 → 로그인
- `/catalog`: 로그인한 직원 기준 상품 카탈로그 + 장바구니(하단 고정바) → 발주 제출
- `/order/complete`: 제출 완료 화면
- 로그인하지 않은 상태로 `/catalog`, `/order/*`에 접근하면 `/login`으로 자동 리다이렉트됩니다 (`src/proxy.ts`).

## 4. 인증/세션 설계

- PIN은 EMPLOYEES.pin_hash에 bcrypt 해시로만 저장되어 있고, 평문 비교는 하지 않습니다.
- 로그인 성공 시 JWT(직원 ID/이름/매장/역할)를 httpOnly 쿠키에 12시간짜리로 저장합니다. 서버 세션 저장소가 따로 필요 없어 Vercel 같은 서버리스 환경에 적합하고, httpOnly라 클라이언트 JS에서 토큰을 훔쳐볼 수 없습니다.
- 로그아웃 API(`/api/auth/logout`)는 만들어뒀지만 화면에 버튼은 아직 없습니다. 필요하면 catalog 페이지에 로그아웃 버튼을 추가하세요.

## 5. 알아두면 좋은 부분 / 확장 포인트

- PRODUCTS DB에는 아직 "매장(store)" 구분 속성이 없어서, 지금은 로그인한 매장과 상관없이 전체 상품을 보여줍니다. 뼈다귀연구소/돈골 취급 상품이 달라지면 PRODUCTS DB에 store(multi-select) 속성을 추가하고 `src/lib/notion.ts`의 `getProductsByStore`에서 필터링하도록 확장하세요.
- 상품 사진은 PRODUCTS.image_url(텍스트, 외부 이미지 URL)을 그대로 `<img>`로 렌더링합니다. 지금 샘플 2개 상품에는 임시 Unsplash 이미지가 들어가 있으니 실제 상품 사진으로 교체하세요.
- 발주 제출 시 장바구니 항목 각각이 ORDER_REQUESTS에 개별 행으로 생성됩니다 (employee/product relation, qty, status="대기"). `requested_at`은 노션 쪽 created_time이라 자동으로 채워집니다.

## 6. Vercel 배포

1. 이 프로젝트를 GitHub 저장소로 push
2. https://vercel.com 에서 "Add New Project" → 저장소 선택
3. 빌드 설정은 Next.js 기본값 그대로 두면 됩니다.
4. "Environment Variables"에 `.env.local`에 있는 6개 값(`NOTION_API_KEY`, 5개 `NOTION_*_DATA_SOURCE_ID`, `SESSION_SECRET`)을 그대로 등록
   - Production/Preview/Development 모두 체크해서 등록하는 걸 추천
5. Deploy 클릭 → 배포된 URL로 접속해 로그인부터 발주 제출까지 한 번 테스트

배포 후에도 PIN을 바꾸고 싶으면 로컬에서 `npm run seed:pins`를 실행하면 됩니다 (노션 DB에 직접 쓰기 때문에 배포 환경과 무관하게 동작).

## 7. 알려진 제약

- 저(에이전트)는 샌드박스 네트워크 정책상 api.notion.com에 직접 접근할 수 없어서, 이 프로젝트의 `npm run build`까지는 여기서 성공 확인했지만 실제 Notion 데이터를 불러오는 화면 동작(로그인, 카탈로그 조회, 발주 제출)은 로컬/배포 환경에서 직접 확인해주셔야 합니다. 코드에 쓰인 Notion 속성 이름(name/pin_hash/store/role, price/unit/vendor/category/image_url, employee/product/qty/status 등)은 실제 노션 DB 스키마와 동일하게 맞춰뒀습니다.
