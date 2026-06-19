# Huong dan su dung Strange TTS PC App cho nguoi non-tech

## 0. Luu y quan trong

App chi mo/chay tu Windows local:

```text
C:\Users\Stephen Strange\StrangeTTS-PC-App
```

Khong mo app tu `\\wsl.localhost\...`. Folder WSL chi la ban mirror code/backup cho agent, khong phai noi de nguoi dung bam shortcut hay chay `npm start`.

## 1. Mo app

Double click shortcut tren Desktop:

```text
Strange TTS PC App
```

Shortcut se mo cua so app `Strange TTS PC App`. Man hinh dau tien la dashboard goc cua extension:

```text
chrome-extension://<extension-id>/pages/dashboard.html
```

Dia chi `http://127.0.0.1:48731` van ton tai nhung chi la backend/debug API noi bo de app va extension noi chuyen voi nhau. Nguoi dung binh thuong khong can mo trang nay va khong can mo Google Chrome thu cong.

Khong can vao folder WSL, khong can chay `npm start` thu cong, khong can dang nhap app trong che do local mac dinh.

## 2. Cac nut tren man hinh chinh

- `Dashboard`: dashboard goc cua extension dang nam ngay trong cua so desktop app. Day chinh la man hinh chinh cua app.
- `Seller Ads`: tao shop moi, import cookies, sau do mo Seller Ads bang profile rieng cua shop do.
- `Cloud Sync`: luu endpoint sync de app/extension dung chung cau hinh.
- `External AI Data`: luu va mo link AI DATA ben ngoai. Link nay nam ngoai pham vi crawler, metric kinh doanh va du lieu local cua app.
- `Huong dan`: xem lai quy trinh dung app ngay trong app.
- `Tai video`: dan link TikTok va tai video ve `Downloads\STRANGETTS_Downloads`.
- `Xem san pham`: bat/tat cau hinh xem san pham.
- `Cai dat xem video`: cau hinh autoplay, am thanh va lap video.
- `Trang thai runtime`: chi mo khi can debug, hien duong dan runtime/profile/permission.

## 3. Tao shop va import cookies

1. Bam `Seller Ads`.
2. Nhap `Ten shop`, vi du `Shop Ha Anh`.
3. Neu co `Seller ID / Shop ID` hoac `Ads Account ID` thi dien, khong co co the bo trong.
4. Import cookies bang mot trong hai cach:
   - Dan duong dan file cookies JSON.
   - Dan truc tiep JSON cookies vao o text.
5. Bam `Tao shop va mo Seller Ads`.

Sau khi tao xong, app se tu:

- Tao profile rieng cho shop.
- Mo cua so app-window rieng cho shop bang Microsoft Edge/Chrome runtime he thong, khong hien banner `Chrome for Testing`.
- Nap extension bundled san.
- Bat developer mode trong profile do.
- Bom cookies vao profile.
- Mo Seller Ads.
- Gan nhan dien shop len cua so Seller Ads: title theo ten shop va badge avatar/ten shop o goc tren trai.
- Moi shop/action co profile rieng co dinh, nen cookies cua shop nay khong tron voi shop khac.

## 4. Mo lai shop da co

Co 2 cach:

- Chon shop trong o `Mo nhanh shop`.
- Hoac bam nut `Seller Ads` o danh sach `Multishop`.

Neu cookies con dung, Seller Ads se vao thang shop, khong quay ve trang login. Neu bi quay ve trang login thi cookies da het han, sai domain, sai account, hoac TikTok yeu cau verify lai.

## 4.1. Refresh data nen

Khi bam `Refresh` tren dashboard de lay data report/campaign, app se uu tien chay ngam:

- Mo runtime headless rieng cho shop, khong hien cua so Seller Ads.
- Nap extension va goi lai logic `fetch_multi_shop` cua extension goc.
- Lay data xong tu dong dong runtime headless.
- Neu TikTok yeu cau login/verify/captcha hoac headless bi chan, app se bao loi/fallback; luc do hay mo shop bang `Seller Ads` de xu ly visible.

## 5. Sua camp GMV

1. Mo shop bang nut `Seller Ads`.
2. Cua so Seller Ads se hien ra cung extension runtime.
3. Kiem tra badge avatar/ten shop o goc tren trai de chac chan dang dung shop.
4. Thao tac sua camp GMV tren Seller Ads nhu workflow extension goc.
5. Khong can cai extension bang tay, khong can pin icon extension tren toolbar.

## 6. Tai video TikTok

1. Bam `Tai video`.
2. Dan link TikTok.
3. Bam `Tai video`.
4. File se nam trong:

```text
C:\Users\<ten-user>\Downloads\STRANGETTS_Downloads
```

## 7. Bao mat du lieu

- App chi bind `127.0.0.1`, khong mo public ra LAN.
- Cookies shop nam trong `data\shops\<shop>\cookies.enc.json` va da ma hoa AES-256-GCM.
- Key giai ma nam tren may tai `data\private\app-secret.key`; khong gui file nay cho nguoi khac.
- App co audit log tai `data\logs\audit.ndjson`, chi ghi metadata va redact token/cookie/password.
- Profile moi shop nam tach rieng trong `%LOCALAPPDATA%\StrangeTTSPcApp\profiles\shop-...`.
- Khong copy folder profile/cookies cho nguoi khac.
- Khong gui token, cookies, API key qua chat cong khai.

## 8. Neu app loi

Lam theo thu tu:

1. Dong cua so desktop app va Chrome/Chromium profile Seller Ads dang mo neu co.
2. Mo PowerShell trong folder app:

```powershell
cd "C:\Users\Stephen Strange\StrangeTTS-PC-App"
```

3. Restart app:

```powershell
npm run restart
```

4. Neu chi muon tat app:

```powershell
npm run stop
```

5. Neu port 48731 bao dang duoc dung, kiem tra:

```powershell
Get-NetTCPConnection -LocalPort 48731 -State Listen
```

## 9. Lenh kiem tra truoc khi ban giao

Chay trong PowerShell:

```powershell
cd "C:\Users\Stephen Strange\StrangeTTS-PC-App"
npm run data:migrate
npm run build
npm run prod:smoke
```

Ket qua mong doi:

- `npm run data:migrate`: neu con cookie raw tu ban cu thi chuyen sang `cookies.enc.json`.
- `npm run build`: security scan va parity audit pass.
- `npm run prod:smoke`: server production len duoc tren port test tu dong, khong bi loi trung port 48731.

## 10. Nhung viec khong nen lam

- Khong chay `npm start` trong duong dan `\\wsl.localhost\...`; Windows CMD co the roi ve `C:\Windows`.
- Khong xoa `data\private`, `data\shops`, `data\runtime` neu chua backup.
- Khong sua truc tiep folder extension goc trong Downloads.
- Khong import extension la vao UI chinh; ban app nay da bundled extension san.
