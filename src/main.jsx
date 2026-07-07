import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#222520',
              color: '#e8ead4',
              border: '1px solid #3d4238',
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '13px',
              padding: '10px 16px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            },
            success: { iconTheme: { primary: '#6D8B46', secondary: '#151210' } },
            error: { duration: 5000, iconTheme: { primary: '#C3403A', secondary: '#151210' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
