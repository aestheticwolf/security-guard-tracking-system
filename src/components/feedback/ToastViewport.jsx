import { Toaster } from "react-hot-toast";

export default function ToastViewport() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4500,
        style: {
          background: "var(--toast-bg)",
          color: "var(--toast-text)",
          border: "1px solid var(--toast-border)",
          backdropFilter: "blur(18px)",
          borderRadius: "18px",
          boxShadow: "var(--toast-shadow)"
        },
        success: {
          duration: 4000,
          iconTheme: {
            primary: "#38c89b",
            secondary: "var(--toast-icon-secondary)"
          }
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: "#fb7185",
            secondary: "var(--toast-icon-secondary)"
          }
        }
      }}
    />
  );
}
