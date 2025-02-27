export const validateIIITREmail = (email: string): boolean => {
  const pattern = /^[a-zA-Z]+\.[0-9]{4}ug[0-9]{4}@iiitranchi\.ac\.in$/;
  return pattern.test(email);
};

export const extractRollNumber = (email: string): string => {
  const match = email.match(/([0-9]{4}ug[0-9]{4})/);
  return match ? match[1] : '';
};

export const extractBatchFromRollNumber = (rollNumber: string): string => {
  // Extract year from rollNumber (first 4 digits)
  const match = rollNumber.match(/^([0-9]{4})ug/);
  if (!match) return '';
  
  // Calculate graduation year (admission year + 4)
  const admissionYear = parseInt(match[1]);
  const graduationYear = (admissionYear + 4).toString();
  
  return graduationYear;
};

export const extractBranchFromRollNumber = (rollNumber: string): string => {
  // Extract the last 4 digits
  const match = rollNumber.match(/ug([0-9]{4})$/);
  if (!match) return '';
  
  // Get the thousands digit
  const lastFourDigits = match[1];
  const thousandsDigit = parseInt(lastFourDigits.charAt(0));
  
  // Determine branch based on thousands digit
  switch (thousandsDigit) {
    case 1:
      return 'CSE';
    case 2:
      return 'ECE';
    case 3:
      return 'CSE with DSAI';
    case 4:
      return 'ECE with IOT';
    default:
      return 'Unknown';
  }
};