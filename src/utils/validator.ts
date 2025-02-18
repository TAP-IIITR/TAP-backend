export const validateIIITREmail = (email: string): boolean => {
    const pattern = /^[a-zA-Z]+\.[0-9]{4}ug[0-9]{4}@iiitranchi\.ac\.in$/;
    return pattern.test(email);
  };
  
  export const extractRollNumber = (email: string): string => {
    const match = email.match(/([0-9]{4}ug[0-9]{4})/);
    return match ? match[1] : '';
  };
  