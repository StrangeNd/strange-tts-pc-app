# Bao mat va du lieu nhay cam

## Nguyen tac hien tai

- Server PC app chi bind `127.0.0.1`, khong mo ra LAN.
- Che do local mac dinh khong hien man hinh dang nhap de van hanh nhanh tren PC rieng. Neu can khoa API bang admin login, chay voi `STTS_REQUIRE_LOGIN=1`.
- Khi bat login, session cookie dung `HttpOnly` va `SameSite=Strict`.
- Mat khau admin duoc hash bang `scrypt`, khong luu plain text.
- Cookie shop khong luu raw JSON nua. App ma hoa cookie bang AES-256-GCM vao `data/shops/<shopId>/cookies.enc.json`.
- Key ma hoa nam local tai `data/private/app-secret.key`, bi `.gitignore`; khong copy key/cookie khi dong goi ban public.
- Neu con file cu `data/shops/<shopId>/cookies.json`, chay `npm run data:migrate` de chuyen sang encrypted store. Security scan se fail neu con raw cookie file.
- Audit log thao tac nam tai `data/logs/audit.ndjson` va tu redact cac field cookie/token/password/secret/header.
- Runtime Chrome dung profile rieng theo tung shop trong `%LOCALAPPDATA%\StrangeTTSPcApp\profiles\...`.
- Extension runtime active duoc copy sang `%LOCALAPPDATA%\StrangeTTSPcApp\extension-runtime` de Chrome Windows load on dinh.
- Moi shop/profile browser nam trong `%LOCALAPPDATA%\StrangeTTSPcApp\profiles\...` va deu nap active extension tu thu vien chung.
- Launcher uu tien Chromium/Chrome-for-testing di kem Playwright neu co, vi Google Chrome tren may nay log `--load-extension is not allowed in Google Chrome, ignoring`.
- Truoc khi nap extension vao mot profile, app chi dong cac Chrome process co command line dung `--user-data-dir` cua profile do; khong dong Chrome ca nhan.
- Thu vien extension nam trong `data/extensions/` va bi `.gitignore` vi extension import thu cong co the chua endpoint/token rieng.
- UI chinh khong yeu cau import extension; app dung bundled extension da audit san. API import extension van nen chi dung cho admin/debug noi bo.
- `data/private/`, `dist/`, runtime profile va log local deu nam trong `.gitignore`.
- Build fail neu phat hien token Telegram, API key Google/Gemini, Apps Script deployment URL that, legacy auth secret trong source app, hoac raw `cookies.json` trong data shop.

## Thay doi so voi extension goc

Nhung gia tri hardcoded nhay cam da duoc xoa khoi ban app copy:

- Telegram bot token
- Telegram chat ID
- Gemini API key
- Apps Script URL
- Legacy auth secret
- Zalo/user IDs mac dinh

Nguoi van hanh phai nhap cac gia tri nay trong man hinh cau hinh extension khi can dung tinh nang tuong ung.

## Khuyen nghi truoc khi thuong mai hoa

1. Neu may dung chung cho nhieu nguoi, bat `STTS_REQUIRE_LOGIN=1` truoc khi thuong mai hoa noi bo.
2. Dung token rieng cho tung khach hang, khong dung chung token noi bo.
3. Khong commit `data/private/`, Chrome profile, cookie export, file log co du lieu khach.
4. Chay `npm run build` truoc khi dong goi.
5. Chay `npm run prod:smoke` sau moi lan sua server/app.
6. Rotate lai token da tung nam trong source goc vi chung da bi hardcoded trong extension cu.
7. Neu admin/debug can dung API import extension, chi import tu nguon tin cay vi extension import co quyen host permissions nhu manifest khai bao.
