# SnapData Gemini OCR and Summary API

This small server provides optional Gemini cloud OCR and note summaries. It keeps the Gemini API key out of the public website. Local OCR, editing, copying and exports do not depend on this service.

## Deploy on Render

1. In Render, choose **New + → Web Service** and connect the `harshavardanpr/SnapData` repository.
2. Choose branch `smart-ocr-summary-upgrade`.
3. Set **Root Directory** to `api`.
4. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
5. Add environment variable `GEMINI_API_KEY` with your key from Google AI Studio. Add it only in Render's environment settings—never commit it to GitHub.
6. Optional environment variable: `GEMINI_MODEL` (defaults to `gemini-2.5-flash`; choose a model currently available to your API key).
7. Deploy and check `https://YOUR-SERVICE.onrender.com/health`. It should return JSON with `"ok": true`.

The frontend currently calls `https://snapdata-summary-api.onrender.com/api/summarize`. If Render assigns a different service URL, change that URL in `script.js` and commit the change to this branch.

## Privacy and limits

- Local OCR is the default. The photo is sent to Gemini for cloud OCR only if the user checks the explicit cloud-OCR consent box and local OCR confidence is low (or no text is found).\n- For summaries, the browser sends only the selected extracted text when a user presses **Summarise with Gemini**; it does not upload the photo.
- The API key is read from the server environment.
- Summary text is limited to 40,000 characters; cloud OCR image data is limited to 7 MB. Requests are limited to eight per IP per minute as a basic abuse guard.
- Gemini free-tier availability, model access, and quotas can change. The summary feature may stop temporarily when quota is exhausted.
- Do not send sensitive student or personal information to a third-party AI service unless you have permission and are comfortable with the provider's data policies.
