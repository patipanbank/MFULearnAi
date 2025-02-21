import { IUser } from "../backend/models/User";

interface RequestWithUser extends Request {
   user?: IUser | { id: string; groups: string[] };
   samlLogoutRequest?: any;
} 