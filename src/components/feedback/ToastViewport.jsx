import { Toaster } from "react-hot-toast";

export default function ToastViewport() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--toast-bg)",
          color: "var(--toast-text)",
          border: "1px solid var(--toast-border)",
          backdropFilter: "blur(18px)",
          borderRadius: "18px",
          boxShadow: "var(--toast-shadow)"
        },
        success: {
          iconTheme: {
            primary: "#38c89b",
            secondary: "var(--toast-icon-secondary)"
          }
        },
        error: {
          iconTheme: {
            primary: "#fb7185",
            secondary: "var(--toast-icon-secondary)"
          }
        }
      }}
    />
  );
}
