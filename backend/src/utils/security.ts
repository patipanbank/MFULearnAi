import bcrypt from 'bcryptjs';

export const verify_password = (plain_password: string, hashed_password: string): boolean => {
  return bcrypt.compareSync(plain_password, hashed_password);
};

export const get_password_hash = (password: string): string => {
  return bcrypt.hashSync(password, 10);
}; 