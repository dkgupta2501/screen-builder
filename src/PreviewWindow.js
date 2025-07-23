import React, { useEffect, useState } from "react";
import PreviewForm from "./components/PreviewForm"; // adjust path if needed

export default function PreviewWindow() {
  const [fields, setFields] = useState(null);

  useEffect(() => {
    const schema = localStorage.getItem("formPreviewSchema");
    if (schema) setFields(JSON.parse(schema));
  }, []);

  if (!fields) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'
    }}>Loading preview...</div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7fafc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 40,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1080, // ← increase this for even more width (e.g., 1200)
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 6px 32px -4px #c5c6cc30",
          padding: "2.5rem 2.5rem 2rem 2.5rem",
          marginBottom: 64,
        }}
      >
        {/* Optional: App branding or header */}
        {/* <div style={{fontWeight: 900, fontSize: 24, marginBottom: 16, letterSpacing: 1}}>Form Preview</div> */}
        <PreviewForm fields={fields} />
      </div>
    </div>
  );
}
