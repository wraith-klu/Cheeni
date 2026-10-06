import { StrictMode } from "react";
import ReactDOM from 'react-dom/client';
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { UserDataProvider } from "./context/userDataContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

import ErrorBoundary from "./components/common/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <UserDataProvider>
            <App />
          </UserDataProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
