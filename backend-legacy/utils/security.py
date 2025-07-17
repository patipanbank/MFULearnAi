from passlib.context import CryptContext

# It's recommended to create a single CryptContext instance for your application
# and use it for all password hashing needs.
# schemes: The list of hashing algorithms to support. 'bcrypt' is the default and recommended one.
# deprecated="auto": This will automatically mark any older hashes (if you add more schemes later)
# for re-hashing upon successful verification.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password) 