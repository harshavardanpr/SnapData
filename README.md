# SnapData

A free, mobile-friendly photo-to-data web app. Take or upload a photo, enhance it, recognise text, numbers or tables in the browser, edit the result, calculate values, share it, and export to TXT, CSV or XLSX.

## Features
- Image editor: zoom, crop, brightness, contrast, sharpening, rotation and save enhanced JPG.
- Browser OCR with free Tesseract.js, with text, number and table recognition profiles.
- High-quality mode splits very large images into overlapping sections to improve small-text recognition and falls back to a normal OCR pass when needed.
- Editable table preview with cell, row and column selection plus row/column editing before export.
- Calculations: add, subtract, multiply or divide selected numbers/cells by any value.
- Copy selected/all data, Web Share when supported, TXT, CSV and XLSX export.
- No account, backend, ads or paid OCR API. Images and extracted data stay in the browser.

## Run locally
```
python3 -m http.server 8000
```

## Render Static Site
Build Command: leave empty  
Publish Directory: `.`

## Privacy / internet note
Images are processed in the browser and are not uploaded by SnapData. Tesseract.js, English OCR data and SheetJS are loaded from public CDNs, so an internet connection is required. No image-processing or OCR backend is used.

## Table workflow
Choose **Table** recognition for a table, or use **Auto**. Open **Table** in Review and organise to correct cells. Select cells, whole rows or columns, then calculate, copy or export.