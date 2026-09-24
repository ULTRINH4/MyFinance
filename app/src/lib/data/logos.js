import mastercard from '$lib/assets/logos/ic_bandeira_master.png';
import visa from '$lib/assets/logos/ic_bandeira_visa.png';

// Bank badges render as a coloured text fallback (see BankLogo.svelte).
// Add `badge: importedImage` entries here to show real bank logos.
export const bankLogos = {};

export const brandLogos = {
  Mastercard: mastercard,
  Visa: visa
};
