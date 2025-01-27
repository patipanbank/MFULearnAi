import { Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

interface ChatHeaderProps {
  onNewChat: () => void;
  onDeleteChat: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onNewChat, onDeleteChat }) => {
  return (
    <div style={{ 
      padding: '10px',
      borderBottom: '1px solid #e8e8e8',
      display: 'flex',
      justifyContent: 'space-between'
    }}>
      <Button 
        type="primary" 
        icon={<PlusOutlined />}
        onClick={onNewChat}
      >
        New Chat
      </Button>
      <Button 
        type="text"
        danger
        icon={<DeleteOutlined />}
        onClick={onDeleteChat}
      >
        Clear Chat
      </Button>
    </div>
  );
};
