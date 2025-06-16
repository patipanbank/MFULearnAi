import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');

    if (window.opener) {
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          const data = { success: true, token, user };
          // IMPORTANT: In a real app, you should specify the target origin
          // for security reasons, not '*'.
          const targetOrigin = window.opener.location.origin;
          window.opener.postMessage(data, targetOrigin);
        } catch (error) {
          console.error("Failed to parse user data from URL.", error);
          window.opener.postMessage({ success: false, error: 'Invalid user data' }, window.opener.location.origin);
        }
      } else {
        console.error("Auth callback is missing token or user data in URL params.");
        window.opener.postMessage({ success: false, error: 'Missing token or user data' }, window.opener.location.origin);
      }
      // Close the popup window once the message has been sent
      window.close();
    } else {
        console.error("No opener window detected. This page should be opened as a popup.");
    }
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p>Authenticating, please wait... You can close this window if it doesn't close automatically.</p>
    </div>
  );
};

export default AuthCallbackPage; 