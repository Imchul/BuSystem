# Cloudflare Pages 배포 설정

## 빌드 설정 (Build Settings)

Cloudflare Pages 대시보드에서 다음과 같이 설정해주세요:

### 필수 설정

1. **Framework preset**: `Vite`
2. **Build command**: `npm run build`
3. **Build output directory**: `dist`
4. **Root directory**: `/` (기본값)

### 환경 변수 (Environment Variables)

Node.js 버전 지정:
- **Variable name**: `NODE_VERSION`
- **Value**: `22`

## 설정 방법

1. Cloudflare Pages 대시보드 접속: https://dash.cloudflare.com/
2. BuSystem 프로젝트 선택
3. **Settings** > **Builds & deployments** 로 이동
4. **Build configuration** 섹션에서 위 설정 입력
5. **Save** 클릭
6. **Retry deployment** 클릭하여 재배포

## 배포 확인

빌드 로그에서 다음을 확인하세요:
- ✅ `Executing user command: npm run build`
- ✅ `vite v7.x.x building for production...`
- ✅ `dist/index.html` 및 `dist/assets/*.js` 생성 확인
- ✅ `Success: Assets published!`

## SPA 라우팅

`public/_redirects` 파일이 자동으로 `dist/_redirects`로 복사되어 React Router가 정상 작동합니다.
