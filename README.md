# SnapData

A free, mobile-friendly photo-to-data web app. Take or upload a photo, enhance it, recognise text, numbers or tables in the browser, edit the result, calculate values, share it, and export to TXT, CSV or XLSX.

## Features
- Dedicated task pages for Extract, Results, Calculate, Copy & Export, Summarise, TT Copier (Timetable Copier), and Teacher Workspace.
- Teacher Workspace includes an editable timetable grid, marks table with totals/percentages and range checks, daily class log, worksheet question organiser, teacher notes with a local key-point helper, and local backup/restore.
- Installable progressive web app with a custom icon, Android/desktop install help, and a service worker that caches only known app-shell assets (not user records or API responses). Offline OCR still needs its OCR library to be available.
- OCR automatically opens the Results page after a successful extraction; navigation keeps the same results available between tasks.
- Image editor: zoom, crop, brightness, contrast, sharpening, rotation and save enhanced JPG.
- Browser OCR with free Tesseract.js, with text, number and table recognition profiles.
- High-quality mode splits very large images into overlapping sections to improve small-text recognition and falls back to a normal OCR pass when needed.
- Native phone-friendly text selection and editing, plus drag-to-select an image region and OCR just that area.
- Editable table preview with cell, row and column selection plus row/column editing before export.
- Calculations: add, subtract, multiply or divide selected numbers/cells by any value.
- Copy selected/all data, Web Share when supported, TXT, CSV and XLSX export.
- No account or ads. Browser OCR keeps images local by default. If you explicitly enable Gemini cloud OCR, the image is sent to Gemini for transcription; this can help with emojis and difficult handwriting. Gemini summaries send only the text you choose.

## Run locally
```
python3 -m http.server 8000
```

## Render Static Site
Build Command: leave empty  
Publish Directory: `.`

## Privacy / internet note
By default, images are processed in the browser with Tesseract.js. Tesseract.js, English OCR data and SheetJS load from public CDNs, so an internet connection is required. Gemini cloud OCR is optional and requires explicit opt-in; when enabled, the image is sent to the SnapData API and Gemini. Summaries send only selected/all extracted text when requested.

## Table workflow
Choose **Table** recognition for a table, or use **Auto**. Open **Table** in Review and organise to correct cells. Select cells, whole rows or columns, then calculate, copy or export.

## Teacher Workspace and local data
The Teacher Workspace saves timetable, marks, class-log entries and notes in this browser's local storage. Use **Privacy & backup** to export/import a JSON backup or clear those tool records. Backups can contain personal information; store them carefully. This is local-device storage, not an encrypted account or cloud-sync service. Avoid putting sensitive student records on a shared device.

The marks tool currently uses three configurable-by-editing-column-label core subjects (Maths, Science and English) with a maximum of 100 each. Check the maximum marks and all OCR results before using them for school records. The worksheet organiser is a text-splitting aid, not a guarantee of perfect question detection.

## Install on Android
Open the live site in Chrome, open the ⋮ menu, and choose **Install app** or **Add to Home screen**. If an install prompt is not available, use the in-app **How to install** button. The app shell can be cached for reopening; OCR libraries and any cloud summaries can still require internet.
