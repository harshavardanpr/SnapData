SnapData
Photo-to-data web app. Take or upload a photo, extract text, numbers, lists and tables with Tesseract.js (in-browser OCR), then edit, filter, sort, calculate, copy and export as TXT or CSV.
No accounts, ads, backend, database or paid APIs. Images never leave the browser.
Files
`index.html`, `style.css`, `script.js`, `README.md`
Run locally
Open `index.html` in a browser, or serve the folder (camera capture needs HTTPS or localhost):
    python3 -m http.server 8000

Deploy on Render (Static Site)
Push these files to a Git repository.
In Render choose New > Static Site and connect the repo.
Build Command: leave empty.
Publish Directory: `.`
Deploy.
Notes
The first scan downloads the OCR engine and English language data from a CDN, so an internet connection is needed.
Numbers only shows items that are numbers (commas, currency symbols and % allowed). Text only shows items without digits.
Use Split into cells to turn table rows into separate items.
Export and copy use selected items when any are selected, otherwise all items.
CSV export splits lines into columns on tabs, pipes or runs of two or more spaces.
