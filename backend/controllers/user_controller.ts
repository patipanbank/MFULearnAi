import { getUserbynameID,createUser } from "../services/user_service";
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from "../config/config";
const guest_login = async (req: Request, res: Response):Promise<void> => {
    try {
        const body:{nameID:string} = await req.body;
        if (!body) {
           res.status(400).json({ message: 'nameID is required' });
        }
        let user = await getUserbynameID(body.nameID);
        if (!user) {
            // for testing purpose
            user = await createUser({nameID: body.nameID,role:'Staffs'});
        }   
        const userData = {
            nameID: user.nameID,
            username: user.username || 'guest',
            email: user.email || 'guest@localhost',
            firstName: user.firstName || 'Guest',
            lastName: user.lastName || 'User',
            groups: [user.role]
          };
        const token = jwt.sign(
            { 
                nameID: userData.nameID,
                username: userData.username,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                groups: userData.groups
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const encodedUserData = Buffer.from(JSON.stringify(userData)).toString('base64');

        const redirectUrl = `/auth-callback?token=${token}&user_data=${encodedUserData}`;
        res.status(200).send(redirectUrl.toString());
    } catch (error:any) {
        res.status(500).json({ message: error.message });
    }
}

export { guest_login };