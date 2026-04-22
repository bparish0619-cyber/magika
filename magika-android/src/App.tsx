import { useState, useEffect } from 'react';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Filesystem } from '@capacitor/filesystem';
import { Magika } from 'magika';

interface DetectionResult {
  id: string;
  name: string;
  path: string;
  label: string;
  score: number;
  fullPrediction: any;
}

function App() {
  const [magika, setMagika] = useState<Magika | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<DetectionResult | null>(null);

  useEffect(() => {
    async function loadMagika() {
      try {
        const m = await Magika.create();
        setMagika(m);
      } catch (e) {
        console.error("Failed to load Magika model", e);
      } finally {
        setIsModelLoading(false);
      }
    }
    loadMagika();
  }, []);

  const b64ToUint8Array = (b64: string) => {
    const binaryString = window.atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const handlePickFiles = async () => {
    if (!magika) return;
    try {
      const result = await FilePicker.pickFiles({ readData: true, limit: 0 });
      if (!result.files || result.files.length === 0) return;
      
      setIsProcessing(true);
      const newResults: DetectionResult[] = [];
      
      for (const file of result.files) {
        if (file.data) {
          const bytes = b64ToUint8Array(file.data);
          const prediction = await magika.identifyBytes(bytes);
          newResults.push({
            id: Math.random().toString(36).substring(7),
            name: file.name,
            path: file.path || '',
            label: prediction.prediction.output.label,
            score: prediction.prediction.score,
            fullPrediction: prediction.prediction
          });
        }
      }
      
      setResults(prev => [...newResults, ...prev]);
    } catch (error) {
      console.error('Error picking files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processDirectoryFiles = async (directoryPath: string) => {
    if (!magika) return;
    
    try {
      const contents = await Filesystem.readdir({ path: directoryPath });
      
      for (const file of contents.files) {
        const childPath = file.uri || `${directoryPath}/${file.name}`;
        
        if (file.type === 'directory') {
           continue;
        }
        
        try {
          const fileData = await Filesystem.readFile({ path: childPath });
          if (fileData.data) {
            const bytes = typeof fileData.data === 'string' 
              ? b64ToUint8Array(fileData.data) 
              : fileData.data as any;
            const prediction = await magika.identifyBytes(bytes);
            setResults(prev => [{
              id: Math.random().toString(36).substring(7),
              name: file.name,
              path: childPath,
              label: prediction.prediction.output.label,
              score: prediction.prediction.score,
              fullPrediction: prediction.prediction
            }, ...prev]);
          }
        } catch (e) {
            console.error('Error reading file in directory', childPath, e);
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }
  };

  const handlePickFolder = async () => {
    if (!magika) return;
    try {
      const result = await FilePicker.pickDirectory();
      if (!result.path) return;
      
      setIsProcessing(true);
      await processDirectoryFiles(result.path);
      
    } catch (error) {
      console.error('Error picking directory:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => setResults([]);
  const removeResult = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResults(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Magika Android</h1>
        <p>AI-Powered Content-Type Detection</p>
      </header>

      <div className="controls">
        <button 
          className="btn btn-primary" 
          onClick={handlePickFiles}
          disabled={isModelLoading || isProcessing}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          Select File(s)
        </button>
        <button 
          className="btn" 
          onClick={handlePickFolder}
          disabled={isModelLoading || isProcessing}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            <line x1="12" y1="11" x2="12" y2="17"></line>
            <line x1="9" y1="14" x2="15" y2="14"></line>
          </svg>
          Select Folder
        </button>
      </div>

      <div className="results-section">
        <div className="results-header">
          <h2>Detection Results</h2>
          <div className="header-actions">
            <div className="status-badge">
              {isModelLoading ? 'Loading Model...' : isProcessing ? 'Processing...' : `Ready (${results.length})`}
            </div>
            {results.length > 0 && (
              <button className="btn-clear-all" onClick={clearAll}>Clear All</button>
            )}
          </div>
        </div>

        {isProcessing && results.length === 0 && (
           <div className="empty-state">
              <div className="loading-spinner"></div>
              <p style={{marginTop: '16px'}}>Analyzing files...</p>
           </div>
        )}

        {!isProcessing && results.length === 0 && !isModelLoading && (
          <div className="empty-state">
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{marginBottom: '16px', opacity: 0.5}}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>No files selected yet.<br/>Tap a button above to begin.</p>
          </div>
        )}

        <div className="results-list">
          {results.map(res => (
            <div key={res.id} className="result-item" onClick={() => setSelectedResult(res)}>
              <div className="file-info">
                <span className="file-name">{res.name}</span>
                <span className="file-path">{res.path}</span>
              </div>
              <div className="prediction">
                <span className="prediction-label">{res.label}</span>
                <span className="score">{(res.score * 100).toFixed(1)}%</span>
                <button className="btn-remove" onClick={(e) => removeResult(res.id, e)} aria-label="Remove">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedResult && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File Details</h3>
              <button className="btn-close" onClick={() => setSelectedResult(null)}>
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Name</span>
                <span className="detail-value">{selectedResult.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Full Path</span>
                <span className="detail-value break-all">{selectedResult.path}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Content Type</span>
                <span className="detail-value highlight">{selectedResult.label}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Is Text?</span>
                <span className="detail-value">{selectedResult.fullPrediction?.output?.is_text ? 'Yes' : 'No'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Confidence Score</span>
                <span className="detail-value">{(selectedResult.score * 100).toFixed(2)}%</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Overwrite Reason</span>
                <span className="detail-value">{selectedResult.fullPrediction?.overwrite_reason || 'None'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
