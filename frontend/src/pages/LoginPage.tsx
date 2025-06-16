import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Col, Row, Typography } from "antd";
import { LockOutlined } from '@ant-design/icons';
import { API_URL } from "../services/api";
import { useAuth } from "../hooks/useAuth";
// import { config } from "../config/config"; // Assuming config is not needed for now

const { Title, Text, Link } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // IMPORTANT: Check the origin of the message for security
      // In a real app, you should replace '*' with your backend's origin
      const backendOrigin = new URL(API_URL).origin;
      if (event.origin !== backendOrigin) {
        console.warn(`Message received from unexpected origin: ${event.origin}. Expected: ${backendOrigin}`);
        return;
      }

      // Assuming the backend sends data in the format { success: true, user: {...}, token: '...' }
      const { success, user, token } = event.data;

      if (success && user && token) {
        console.log("SAML Login successful, received data:", event.data);
        login(user, token); // Update auth store
        navigate("/chat"); // Navigate to chat page
      } else {
        console.error("SAML Login failed or data is missing.", event.data);
        // Here you could show an error message to the user
      }
    };

    window.addEventListener("message", handleAuthMessage);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener("message", handleAuthMessage);
    };
  }, [navigate, login]);

  const handleSamlLogin = () => {
    const samlLoginUrl = `${API_URL}/auth/login/saml`;
    const width = 600, height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    // Open a popup window pointing to the SAML login endpoint
    window.open(
      samlLoginUrl, 
      "SAML Login", 
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const handleAdminLogin = () => {
    navigate('/admin/login');
  };

  return (
    <Row 
      justify="center" 
      align="middle" 
      className="min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/mfu_background_login.jpg')" }}
    >
      <div className="absolute inset-0 bg-white/50 dark:bg-black/30"></div>
      <Col xs={22} sm={16} md={12} lg={8} xl={7} className="relative z-10">
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg">
            <div className="text-center p-4">
              <img src="/mfu_logo_chatbot.PNG" alt="MFU Logo" className="mx-auto h-24 w-auto mb-4" />
              <Title level={2} className="text-gray-900 dark:text-white">
                Login to <span style={{ 
                  background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>DIN</span>DIN <span style={{
                  background: 'linear-gradient(to right, #00FFFF, #0099FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>AI</span>
              </Title>
              <Text className="text-gray-600 dark:text-gray-300">
                Your 24/7 AI Assistant for Mae Fah Luang University
              </Text>
            </div>
            <div className="p-4">
              <Button 
                type="primary" 
                size="large"
                icon={<LockOutlined />} 
                onClick={handleSamlLogin}
                className="w-full"
                style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
              >
                Login with MFU SSO
              </Button>
              <div className="mt-4 text-center">
                <Link onClick={handleAdminLogin} className="text-sm">
                  Admin Login
                </Link>
              </div>
            </div>
        </Card>
      </Col>
    </Row>
  );
};

export default LoginPage; 