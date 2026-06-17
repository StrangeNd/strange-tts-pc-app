# Strange TTS PC App

Day la ban PC app duoc tach rieng tu extension goc `Strange_TTS_Solution`. Thu muc goc chi duoc copy, khong bi sua truc tiep.

## Nguyen tac chay app

Ban production phai chay tu folder Windows local:

```text
C:\Users\Stephen Strange\StrangeTTS-PC-App
```

Khong mo/chay app tu `\\wsl.localhost\...`. Ban trong WSL chi la mirror code de agent tham chieu/sync, khong phai runtime app vi Windows `cmd.exe`/desktop runtime khong chay on dinh voi current directory dang UNC/WSL.

## Chay production

```powershell
cd "C:\Users\Stephen Strange\StrangeTTS-PC-App"
.\scripts\build.ps1
.\scripts\start-pc-app.ps1
```

## Mo bang shortcut Desktop

Shortcut da tao tren Desktop:

```text
C:\Users\Stephen Strange\OneDrive\Desktop\Strange TTS PC App.lnk
```

Shortcut nay chay `scripts\open-desktop-app.ps1` va mo cua so app-window ten `Strange TTS PC App`. Cua so nay load thang dashboard goc cua extension, khong hien thanh dia chi browser va khong bat nguoi dung mo `localhost`.

```text
chrome-extension://<extension-id>/pages/dashboard.html
```

`http://127.0.0.1:48731` chi con la backend/debug API noi bo. Day la cong local tren may de app va extension noi chuyen voi nhau; nguoi dung binh thuong khong mo trang nay.

Neu can debug runtime Chrome/extension cu:

```powershell
.\scripts\start-pc-app.ps1 -Launch
```

Neu chay bang `npm`, hay chay tu folder Windows local nay:

```powershell
cd "C:\Users\Stephen Strange\StrangeTTS-PC-App"
npm start
```

Khong chay `npm start` truc tiep trong `\\wsl.localhost\...` vi `cmd.exe` cua Windows khong ho tro current directory dang UNC.

Neu app da chay san, `npm start` se chi bao `Already running` va khong mo them server trung port. De tat hoac khoi dong lai:

```powershell
npm run stop
npm run restart
```

## Cau truc

- `extension/`: ban copy extension goc, giu logic Chrome extension dang hoat dong.
- `app/`: server local, app config, video downloader, extension runtime, launcher app-window/debug.
- `public/`: debug shell/API UI noi bo, khong phai man hinh chinh cua app.
- `scripts/`: build, smoke test, security scan, parity audit.
- `docs/`: huong dan nguoi dung va ghi chu bao mat.
- `data/private/`: password hash va secret runtime local, bi gitignore.
- `data/extensions/`: thu vien extension runtime do app quan ly, bi gitignore.
- `data/shops/<shopId>/cookies.enc.json`: cookie shop da ma hoa AES-256-GCM, bi gitignore.
- `data/logs/audit.ndjson`: audit log da redact token/cookie/header.

## Co che app + extension library

Ban app nay khong rewrite logic extension da chay on dinh. App dong vai tro control plane:

- Dashboard chinh la dashboard goc cua extension (`chrome-extension://.../pages/dashboard.html`) duoc app mo trong cua so app-window khong co thanh dia chi.
- Ben duoi app-window van can Chromium engine de giu du 100% Chrome extension APIs. Runtime uu tien Microsoft Edge app-window de khong hien banner `Chrome for Testing`; nguoi dung khong phai mo browser thu cong va khong thay `localhost`.
- Backend local van chay an trong may tai `127.0.0.1` de giu API local/cookie/video/security scan.
- Extension bundled duoc quan ly nhu package runtime trong `data/extensions/`, khong can import extension tren UI chinh.
- Active extension duoc sync vao `%LOCALAPPDATA%\StrangeTTSPcApp\extension-runtime`.
- Moi shop/action mo trang rieng bang profile rieng trong `%LOCALAPPDATA%\StrangeTTSPcApp\profiles\shop-...`, nen cookies/storage/tab cua shop nay khong tron voi shop khac.
- Launcher uu tien Microsoft Edge/Chrome he thong truoc de khong hien `Chrome for Testing`; chi fallback sang Chromium Playwright neu may khong co runtime phu hop.
- Khi mo Seller Ads/Payment/Verification, launcher dong dung process cua profile shop do truoc, nap lai active extension bang `--load-extension`, bom cookies shop qua DevTools Protocol, vao dung URL bang app-window rieng va giu extension content panel tren trang Seller.
- Cua so Seller Ads se doi title theo ten shop va hien badge co avatar/ten shop o goc tren trai trang Seller de tranh thao tac nham shop.
- Khi dashboard chi refresh/lay data, app uu tien endpoint headless `POST /api/runtime/fetch-shop-data`: mo Edge/Chrome headless bang profile shop rieng, nap extension runtime, de `background.js` chay lai action `fetch_multi_shop`, lay data roi tu dong dong process. Neu headless runtime loi, dashboard fallback ve background extension cu.

Nghia la cai dat extension chi lam mot lan trong app; khi mo profile/shop nao, app tu nap active extension cho profile do. Nguoi dung chi can tao shop/import cookies roi bam Seller Ads.

## Bao mat cookie local

Cookie import vao app duoc ma hoa vao `cookies.enc.json`. Key nam local trong `data/private/app-secret.key`, khong commit va khong copy sang ban public. Neu nang cap tu ban cu con `cookies.json`, chay:

```powershell
npm run data:migrate
```

Security scan se fail neu con raw `data/shops/*/cookies.json`.

## Kiem tra bat buoc

```powershell
npm run data:migrate
node .\scripts\security-scan.mjs
node .\scripts\parity-audit.mjs
npm run prod:smoke
```
