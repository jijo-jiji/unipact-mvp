// Closed-beta applications go to the same Google Apps Script sheet the unipact.my marketing site uses,
// so leads from both places land in one list. Set VITE_LEADS_ENDPOINT to point at a different sheet.
const ENDPOINT = import.meta.env.VITE_LEADS_ENDPOINT
  || 'https://script.google.com/macros/s/AKfycby-N6kcIULA32Ltht_7F6PVnMCfneqplIV_iNR5uri7IlQawXbDk8Zstv8CvSyws9sd9g/exec';

// The sheet cannot send CORS headers, so the request goes out in no-cors mode and the browser hides the
// response: a resolved promise means the request left the browser, not that the sheet stored the row.
export const submitLead = async (values) => {
  const body = new FormData();
  Object.entries(values).forEach(([field, value]) => {
    if (Array.isArray(value)) value.forEach((entry) => body.append(field, entry));
    else body.append(field, value ?? '');
  });
  await fetch(ENDPOINT, { method: 'POST', body, mode: 'no-cors' });
};
