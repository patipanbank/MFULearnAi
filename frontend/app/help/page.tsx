export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Help & Documentation</h1>
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">How to Use the System</h2>
        <ol className="list-decimal list-inside text-gray-700 space-y-1">
          <li>Login with your MFU account or as a guest (limited features).</li>
          <li>Use the sidebar to navigate between Chat, Models, Collections, Departments, Admins, System Prompt, and Statistics.</li>
          <li>Start a new chat, upload documents, or manage models and collections as your role allows.</li>
          <li>Admins and SuperAdmins can manage departments, admin users, and system prompt.</li>
          <li>Check usage statistics and system analytics in the Statistics section.</li>
        </ol>
      </section>
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Frequently Asked Questions (FAQ)</h2>
        <div className="mb-2">
          <span className="font-semibold">Q:</span> How do I upload a document?<br/>
          <span className="font-semibold">A:</span> Go to Collections, select a collection, and use the upload button to add your file.
        </div>
        <div className="mb-2">
          <span className="font-semibold">Q:</span> Who can create or edit models?
          <br/>
          <span className="font-semibold">A:</span> Only Admins and SuperAdmins can create official or department models. All users can create personal models.
        </div>
        <div className="mb-2">
          <span className="font-semibold">Q:</span> How do I reset my password?
          <br/>
          <span className="font-semibold">A:</span> Please contact your MFU IT support for password resets.
        </div>
        <div className="mb-2">
          <span className="font-semibold">Q:</span> Why can't I access some pages?
          <br/>
          <span className="font-semibold">A:</span> Access is based on your user role. Some features are restricted to Admins or SuperAdmins.
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">Contact & Support</h2>
        <p className="text-gray-700 mb-1">For technical support or questions, contact:</p>
        <ul className="list-disc list-inside text-gray-700">
          <li>Email: <a href="mailto:support@mfu.ac.th" className="text-blue-600 underline">support@mfu.ac.th</a></li>
          <li>Phone: 0-5391-6000 ext. 1234</li>
          <li>MFU IT Service Desk</li>
        </ul>
      </section>
    </div>
  );
} 