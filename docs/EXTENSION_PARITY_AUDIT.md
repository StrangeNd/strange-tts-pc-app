# Extension parity audit

Muc tieu cua ban PC app la bam sat extension goc, khong rewrite logic crawl/API/cookie dang hoat dong.

Lenh audit:

```powershell
node .\scripts\parity-audit.mjs
```

Mac dinh lenh nay so sanh:

```text
C:\Users\Stephen Strange\Downloads\Telegram Desktop\Strange_TTS_Solution (2)\Strange_TTS_Solution
```

voi:

```text
extension/
```

Cac file duoc phep khac extension goc:

- `src/background.js`
- `src/content.js`
- `src/dashboard.js`
- `src/login.js`
- `src/report.js`

Ly do: cac file nay da duoc sanitize de xoa hardcoded secret khoi ban app thuong mai.

Bao cao JSON duoc ghi tai:

```text
dist/extension-parity-audit.json
```
