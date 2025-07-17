// Test script to debug SAML response
const axios = require('axios');

async function testSAMLCallback() {
  try {
    console.log('Testing SAML callback...');
    
    // Mock SAML response data (you can replace this with real data from your IDP)
    const mockSAMLBody = {
      SAMLResponse: 'PHNhbWxwOlJlc3vbnNlIHhtbG5zOnNhbWxwPSJ1cm462FzaXM6bmFtZXM6GM6U0NTDoyLjA6cHJvdG9jb2wiIHhtbG5zOnNhbWw9InVybjpvYXNpczpuYW1czp0YzpTQU1MOjIuMDphc3NlcnRpb24iIElEPSJfODk5YzFhYzYtYzFhYy02YzFhYy1jMWFjLTY5YzFhYzFhYyIgVmVyc2lvbj0iMi4IiBJc3N1ZUluc3RhbnQ9jIwMjQtMDEtMDFUMDA6MDA6DBaIiBEZXN0aW5hdGlvbj0iaHR0cDovL2xvY2saG9zdDozMDAwL2FwaS9hdXRoL3NhbWwvY2FsbGJhY2iPjxzYW1Oklzc3Vlcj5odHRwOi8vbG9jYWxob3N0jMwMDA8L3NhbWw6SXNzdWVyPjxzYW1scDpTdGF0XM+PHNhbWxwOlN0YXR1c0/ZGUgVmFsdWU9InVybjpvYXNpczpuYW1czp0zpTQU1MOjIuMDpzdGF0XM6U3jY2VzcyIvPjwvc2FtbHA6U3hdHVzPjxzYW1OkFzc2VydGlvbiBJRD0XzEyMzQ1Njc4LTkwYWJjLWRlZi0xMjM0LTU2zg5GFiY2RlZiIgSXNzdWVJbnN0W50SIyMDI0LTAxLTAxVDAwOjAwOjAwWiIgVmVyc2vbj0iMi4Ij482FtbDpJc3N1ZXI+aHR0cDovL2xvY2FsaG9zdDozMDAwPC9zYW1sOklzc3Vlcj48c2FtbDpTdWJqZWN0PjxzYW1sOk5hbWVJRCBTUE5bWVRdWFsaWZpZXI9mh0dHA6Ly9sb2hbGhvc3Q6MzAwMCI+RGVtb1zZXJAZXhhbXBsZS5jb208L3NhbWw6TmFtZUlEPjxzYW1sOlN1mplY3RDb25maXJtYXRpb24gTWV0G9PSJ1cm462FzaXM6bmFtZXM6GM60FNTDoyLjA6Y206YmVhcmVyIj482FtbDpTdWJqZWN029ZmlybWF0aW9RGF0YSBOb3RPbk9yQWZ0XI9jIjAyNC0wMS0wMVQwMDowMDowMFoiIFJlY2lwaWVudD1odHRwOi8vW29oLWhvc3Q6MzAwMC9hcGkvYXV0C9YW1L2NhbGxiYWNrIi8+PC9zYW1sOlN1mplY3RDb25aXJtYXRpb24+PC9YW1sOlN1mplY3Q+PHNhbWw6Q29uZGl0W9czPjxzYW1sOkF1ZGllbmNlUmVzdHJpY3Rpb24+PHNhbWw6QXVkaWVuY2U+aHR0cDovL1tvYWwtaG9zdDozMDAwPC9zYW1sOkF1ZGllbmNlPjwvc2FtbDpBdWRpZW5jZVJlc3RyaWN0aW9uPjwvc2FtbDpDb25kaXRW9ucz482FtbDpBdHRyaWJ1dGVTdGF0W1lbnQ+PHNhbWw6QXR0cmlidXRlIE5bWU9InVzZXJuYW1IiBOYW1lRm9ybWF0PSJ1cm462FzaXM6bmFtZXM6GM60NTDoyLjA6YXR0cmlidXRlLW5hbWUtZm9ybWF0OmJhc2jIj482FtbDpBdHRyaWJ1GVWYWx1ZT5kZW1vdXNlcjwvc2FtbDpBdHRyaWJ1dGVWYWx1T483NhbWw6QXR0cmlidXRlPjxzYW1OkF0dHJpYnV0SBOYW1PSJlbWFpbCIgTmFtZUZvcm1dD0idXJuOm9c2zOm5bWVzOnRjOlNBTUw6Mi4OmF0dHJpYnV0ZS1uYW1lLWZvcm1hdDpiYXNpYyI+PHNhbWw6QXR0mlidXRlVmFsdWU+RGVtb1zZXJAZXhhbXBsZS5jb2083NhbWw6QXR0cmlidXRlVmFsdWU+PC9YW1sOkF0dHJpYnV0T483NhbWw6XR0cmlidXRlU3hdGVtZW50Pjwvc2FtbDpBc3lcnRpb24+PC9YW1DpSZXNwb25zZT4=',
      RelayState: ''
    };

    console.log('Sending mock SAML response to callback endpoint...');    const response = await axios.post('http://localhost:300auth/saml/callback', mockSAMLBody, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SAML-Test-Client/1.0'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Response data:', response.data);
    
  } catch (error) {
    console.error('Error testing SAML callback:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSAMLCallback(); 