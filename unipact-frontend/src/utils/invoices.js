import api from '../api/client';

// Fetched through the API client (not a plain link) so an expired sign-in is refreshed first
export const downloadInvoice = async (invoice) => {
  const res = await api.get(`/payments/invoices/${invoice.id}/pdf/`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoice.number}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
