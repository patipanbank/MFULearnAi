import React, { useState } from 'react';
import axios from 'axios';
import { config } from '../../config/config';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface Entity {
  type: string;
  value: string;
  start: number;
  end: number;
}

interface Condition {
  type: string;
  expression: string;
  start: number;
  end: number;
}

interface ContextInfo {
  previousQuestions: string[];
  relevantEntities: Record<string, any>;
  currentTopic?: string;
}

interface AnalysisResult {
  originalQuestion: string;
  preprocessedQuestion: string;
  intent: string;
  entities: Entity[];
  conditions: Condition[];
  context: ContextInfo;
  questionComplexity: number;
  keywords: string[];
  language: string;
  customPrompt: string;
  requiresExternalData: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QuestionAnalysis: React.FC = () => {
  const { isAdmin, isLoading } = useAuth();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // If still loading auth state, show loading
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // If not admin, redirect to home
  if (!isAdmin) {
    return <Navigate to="/mfuchatbot" />;
  }

  const handleAnalyze = async () => {
    if (!question.trim()) {
      setError('Please enter a question to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      // Parse history into messages array if provided
      const messages: Message[] = [];
      if (history.trim()) {
        history
          .split('\n')
          .filter(line => line.trim())
          .forEach(line => {
            if (line.startsWith('User:')) {
              messages.push({
                role: 'user',
                content: line.replace('User:', '').trim()
              });
            } else if (line.startsWith('Assistant:')) {
              messages.push({
                role: 'assistant',
                content: line.replace('Assistant:', '').trim()
              });
            }
          });
      }

      const response = await axios.post(
        `${config.apiUrl}/api/chat/analyze`,
        { question, messages },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );

      setAnalysisResult(response.data.analysis);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze the question. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Question Analysis Tool</h1>
      <p className="mb-6 text-gray-700">
        This tool helps you analyze questions to understand their intent, entities, and complexity.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question:
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter a question to analyze..."
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Conversation History (Optional):
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          rows={5}
          value={history}
          onChange={(e) => setHistory(e.target.value)}
          placeholder="Enter conversation history in format: 'User: question' and 'Assistant: answer' (each on a new line)"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <button
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        onClick={handleAnalyze}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Question'}
      </button>

      {analysisResult && (
        <div className="mt-8 p-6 border border-gray-300 rounded-md bg-white shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Analysis Results</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Basic Information</h3>
              <div className="text-sm space-y-2">
                <p><span className="font-semibold">Original Question:</span> {analysisResult.originalQuestion}</p>
                <p><span className="font-semibold">Preprocessed Question:</span> {analysisResult.preprocessedQuestion}</p>
                <p><span className="font-semibold">Intent:</span> {analysisResult.intent}</p>
                <p><span className="font-semibold">Language:</span> {analysisResult.language}</p>
                <p><span className="font-semibold">Complexity Score:</span> {analysisResult.questionComplexity}/10</p>
                <p><span className="font-semibold">Requires External Data:</span> {analysisResult.requiresExternalData ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {analysisResult.keywords.map((keyword, i) => (
                  <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Entities</h3>
            {analysisResult.entities.length === 0 ? (
              <p className="text-gray-500">No entities detected</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analysisResult.entities.map((entity, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entity.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entity.value}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entity.start}-{entity.end}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Logical Conditions</h3>
            {analysisResult.conditions.length === 0 ? (
              <p className="text-gray-500">No logical conditions detected</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expression</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analysisResult.conditions.map((condition, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{condition.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{condition.expression}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Custom Prompt</h3>
            <div className="p-4 bg-gray-50 rounded-md">
              <pre className="whitespace-pre-wrap text-sm">{analysisResult.customPrompt}</pre>
            </div>
          </div>

          {analysisResult.context.currentTopic && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Conversation Context</h3>
              <p><span className="font-semibold">Current Topic:</span> {analysisResult.context.currentTopic}</p>
              
              {analysisResult.context.previousQuestions.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-md font-medium text-gray-900">Previous Questions:</h4>
                  <ul className="list-disc pl-5 mt-1">
                    {analysisResult.context.previousQuestions.map((q, i) => (
                      <li key={i} className="text-sm text-gray-700">{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionAnalysis; 