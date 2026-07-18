import React from "react";
import "./styles/dailycash.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import LoginScreen from "./components/LoginScreen";
import Shell from "./components/Shell";

function Gate() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <LoginScreen />;
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
