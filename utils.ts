export const formatPhoneNumber = (value: string) => {
  if (!value) return "";
  const phoneNumber = value.replace(/\D/g, "");
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export const formatTaxId = (value: string) => {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "").slice(0, 9);
  if (cleaned.length < 3) return cleaned;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
};

export const formatSsn = (value: string) => {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "").slice(0, 9);
  if (cleaned.length < 4) return cleaned;
  if (cleaned.length < 6) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
};

export const numberToWordsSpanish = (num: number): string => {
  if (num === 0) return "CERO";
  const units = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const tens = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const teens = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const hundreds = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  const convertGroup = (n: number): string => {
    let output = "";
    if (n >= 100) {
      if (n === 100) return "CIEN";
      output += hundreds[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 20) {
      if (n === 20) return output + "VEINTE";
      if (n > 20 && n < 30) {
        output += "VEINTI" + units[n - 20];
      } else {
        output += tens[Math.floor(n / 10)] + (n % 10 > 0 ? " Y " + units[n % 10] : "");
      }
    } else if (n >= 10) {
      output += teens[n - 10];
    } else if (n > 0) {
      output += units[n];
    }
    return output.trim();
  };

  const integer = Math.floor(num);
  const decimals = Math.round((num - integer) * 100);

  let words = "";
  if (integer >= 1000000) {
    const millions = Math.floor(integer / 1000000);
    const remainder = integer % 1000000;
    words += (millions === 1 ? "UN MILLÓN" : convertGroup(millions) + " MILLONES") + " ";
    if (remainder > 0) {
      if (remainder >= 1000) {
        const thousands = Math.floor(remainder / 1000);
        words += (thousands === 1 ? "MIL" : convertGroup(thousands) + " MIL") + " " + convertGroup(remainder % 1000);
      } else {
        words += convertGroup(remainder);
      }
    }
  } else if (integer >= 1000) {
    const thousands = Math.floor(integer / 1000);
    words += (thousands === 1 ? "MIL" : convertGroup(thousands) + " MIL") + " " + convertGroup(integer % 1000);
  } else {
    words += convertGroup(integer);
  }

  const centsStr = decimals < 10 ? `0${decimals}` : `${decimals}`;
  return `${words.trim()} CON ${centsStr}/100 USD`;
};

export const numberToWordsEnglish = (num: number): string => {
  if (num === 0) return "ZERO";
  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  const convertGroup = (n: number): string => {
    let output = "";
    if (n >= 100) {
      output += ones[Math.floor(n / 100)] + " HUNDRED ";
      n %= 100;
    }
    if (n >= 20) {
      output += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      output += ones[n] + " ";
    }
    return output.trim();
  };

  const integer = Math.floor(num);
  const decimals = Math.round((num - integer) * 100);

  let words = "";
  if (integer >= 1000000) {
    const millions = Math.floor(integer / 1000000);
    const remainder = integer % 1000000;
    words += convertGroup(millions) + " MILLION ";
    if (remainder > 0) {
      if (remainder >= 1000) {
        const thousands = Math.floor(remainder / 1000);
        words += convertGroup(thousands) + " THOUSAND " + convertGroup(remainder % 1000);
      } else {
        words += convertGroup(remainder);
      }
    }
  } else if (integer >= 1000) {
    const thousands = Math.floor(integer / 1000);
    words += convertGroup(thousands) + " THOUSAND " + convertGroup(integer % 1000);
  } else {
    words += convertGroup(integer);
  }

  const centsStr = decimals < 10 ? `0${decimals}` : `${decimals}`;
  return `${words.trim()} AND ${centsStr}/100 DOLLARS`;
};

