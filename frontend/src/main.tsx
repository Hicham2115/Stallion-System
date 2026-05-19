import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import App from "./App";
import { AuthProvider } from "@/context/AuthContext";
import { PortalAuthProvider } from "@/context/PortalAuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <ThemeProvider>
        <AuthProvider>
          <PortalAuthProvider>
            <CurrencyProvider>
              <App />
            </CurrencyProvider>
          </PortalAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
