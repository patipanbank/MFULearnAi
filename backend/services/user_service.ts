import User, { IUser } from '../models/User';

// Create a new user
export const createUser = async (userData: IUser) : Promise<{
    nameID: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    groups: string[];
}> => {
    try {
        const user = new User(userData);
        await user.save();
        return {
            nameID: user.nameID,
            username: user.username || 'guest',
            email: user.email || 'guest@localhost',
            firstName: user.firstName || 'Guest',
            lastName: user.lastName || 'User',
            role: user.role,
            groups: user.groups,
        };
    } catch (error: any) {
        throw new Error(`Error creating user: ${error.message}`);
    }
};

export const getUserbynameID = async (nameID: string) => {
    try {
        const user = await User.findOne({nameID: nameID});
        if (!user) {
           return null;
        }
        return {
            nameID: user.nameID,
            username: user.username || 'guest',
            email: user.email || 'guest@localhost',
            firstName: user.firstName || 'Guest',
            lastName: user.lastName || 'User',
            role: user.role,
            groups: user.groups,
        };
    } catch (error:any) {
        throw new Error(`Error fetching user: ${error.message}`);
    }
}

// Read a user by ID
export const getUserById = async (id: string) => {
    try {
        const user = await User.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error:any) {
        throw new Error(`Error fetching user: ${error.message}`);
    }
};

// Update a user by ID
export const updateUserById = async (id: string, updateData: any) => {
    try {
        const user = await User.findByIdAndUpdate(id, updateData, { new: true });
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error:any) {
        throw new Error(`Error updating user: ${error.message}`);
    }
};

export const updateUserBynameID = async (nameID: string, updateData: IUser) => {
    try {
        const user = await User.findOne({nameID: nameID});
        if (!user) {
            throw new Error('User not found');
        }
        user.username = updateData.username || user.username ;
        user.email = updateData.email || user.email;
        user.firstName = updateData.firstName || user.firstName;
        user.lastName = updateData.lastName || user.lastName;
        user.groups = updateData.groups || user.groups;
        user.role = updateData.role || user.role;
        user.updated = new Date();
        await user.save();
        return user;
    } catch (error:any) {
        throw new Error(`Error updating user: ${error.message}`);
    }
}

// Delete a user by ID
export const deleteUserById = async (id: string) => {
    try {
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error:any) {
        throw new Error(`Error deleting user: ${error.message}`);
    }
};