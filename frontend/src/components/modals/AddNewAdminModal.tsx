import BaseModal from "./BaseModal";

interface AddNewAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminAdded: () => void; // To refetch the list
}

const AddNewAdminModal = ({ isOpen, onClose, onAdminAdded }: AddNewAdminModalProps) => {

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would call a service to add the admin
    console.log("Adding new admin...");
    // For now, just close the modal and trigger a refetch
    onClose();
    onAdminAdded();
  }

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Add New Administrator">
      <form onSubmit={handleAddAdmin}>
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Username</label>
            <input type="text" name="username" id="username" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" placeholder="john.doe" required />
          </div>
          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Email</label>
            <input type="email" name="email" id="email" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" placeholder="name@company.com" required />
          </div>
          <div>
            <label htmlFor="password_new" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Password</label>
            <input type="password" name="password" id="password_new" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" placeholder="••••••••" required />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500">
            Cancel
          </button>
          <button type="submit" className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Add Admin
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

export default AddNewAdminModal; 