import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ChatDashboard from './pages/ChatDashboard';

function App() {
  // Simple check for user in localStorage (we can improve this later with Context)
  const user = JSON.parse(localStorage.getItem('cortex_user'));

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!user ? <Login /> : <Navigate to="/" />} 
      />
      <Route 
        path="/" 
        element={user ? <ChatDashboard user={user} /> : <Navigate to="/login" />} 
      />
      {/* We can add dynamic routes like /chat/:id later */}
      <Route 
        path="/chat/:chatId" 
        element={user ? <ChatDashboard user={user} /> : <Navigate to="/login" />} 
      />
    </Routes>
  );
}

export default App;
