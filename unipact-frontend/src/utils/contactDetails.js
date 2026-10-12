// Spots contact details in a message someone is about to send in a project conversation.
// The agreements keep client and talent working through UniPact (including for 12 months afterwards),
// so the conversation warns before these are shared. It never blocks: there are honest reasons to share
// one, and UniPact can read the conversation anyway.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;

// Malaysian mobile (01x) and landline (03-09) numbers, with or without +60, or any number written with a
// country code. Deliberately narrow: invoice numbers, dates and prices should not set it off.
const PHONE = new RegExp([
  String.raw`(?:^|[^\d])(?:\+?60|0)1\d[\s-]?\d{3,4}[\s-]?\d{4}(?!\d)`,
  String.raw`(?:^|[^\d])(?:\+?60|0)[3-9][\s-]?\d{3,4}[\s-]?\d{4}(?!\d)`,
  String.raw`\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}(?!\d)`,
].join('|'));

const CHAT_APP = /\b(?:wa\.me|whatsapp|wasap|telegram|t\.me)\b/i;

// What the text seems to contain, in words ready for a sentence: [] when nothing was spotted
export const findContactDetails = (text) => {
  const found = [];
  if (EMAIL.test(text)) found.push('an email address');
  if (PHONE.test(text)) found.push('a phone number');
  if (CHAT_APP.test(text)) found.push('a chat app contact');
  return found;
};

export const joinWithOr = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`);
