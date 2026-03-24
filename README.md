# MoaPay — 한국 개발자를 위한 결제 인프라

Stripe처럼 쉽고, 한국 결제를 완전히 지원하는 결제 시스템 랜딩 페이지입니다.

## 파일 구조

```
moapay/
├── index.html          # 메인 랜딩 페이지
├── css/
│   └── main.css        # 전체 스타일
├── js/
│   └── main.js         # 공통 스크립트
├── pages/
│   ├── demo.html       # 결제 데모
│   ├── pricing.html    # 요금제
│   ├── docs.html       # API 문서
│   ├── signup.html     # 회원가입
│   └── login.html      # 로그인
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Pages 자동 배포
```

## GitHub Pages 배포 방법

### 1단계 — GitHub 저장소 만들기

1. [github.com/new](https://github.com/new) 접속
2. Repository name: `moapay` (또는 원하는 이름)
3. **Public** 선택 (GitHub Pages 무료 사용 조건)
4. **Create repository** 클릭

### 2단계 — 파일 올리기

```bash
# 로컬에서 진행
git init
git add .
git commit -m "feat: MoaPay 랜딩 페이지 초기 배포"
git branch -M main
git remote add origin https://github.com/[내아이디]/moapay.git
git push -u origin main
```

### 3단계 — GitHub Pages 활성화

1. 저장소 → **Settings** → **Pages**
2. Source: **GitHub Actions** 선택
3. 저장하면 자동으로 배포 시작

### 4단계 — 배포 확인

`https://[내아이디].github.io/moapay/` 접속

배포까지 약 1~3분 소요됩니다.

## 커스텀 도메인 연결 (선택)

1. 도메인 DNS에 CNAME 레코드 추가: `[내아이디].github.io`
2. Settings → Pages → Custom domain 입력
3. `moapay/` 루트에 `CNAME` 파일 생성 후 도메인 입력

## 다음 단계

- [ ] 실제 결제 API 백엔드 연동 (Node.js / Next.js)
- [ ] 관리자 대시보드 페이지
- [ ] 모바일 앱 (React Native / Flutter)
