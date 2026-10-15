# SnapData

A free, mobile-friendly photo-to-data web app. Take or upload a photo, enhance it, recognise text, numbers or tables in the browser, edit the result, calculate values, share it, and export to TXT, CSV or XLSX.

## Features
- Dedicated task pages for Extract, Results, Calculate, Copy & Export, and Summarise, so tools are not all crowded into one long screen.
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