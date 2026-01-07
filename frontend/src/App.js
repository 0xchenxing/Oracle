import './App.css';
import React from 'react';
import FileUploadForm from './components/FileUploadForm';
import WalletConnect from './components/WalletConnect';

function App() {
  return (
    <div className="App">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        padding: '16px', 
        borderBottom: '1px solid #f0f0f0'
      }}>
        <WalletConnect />
      </div>
      <FileUploadForm />
    </div>
  );
}

export default App;