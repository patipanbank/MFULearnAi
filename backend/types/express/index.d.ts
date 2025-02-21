declare namespace Express {
  export interface User {
    _id: string;
    role: string;
    groups: string[];
    // add additional user properties as needed
  }
} 