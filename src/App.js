import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import WidgetList from './components/WidgetList';
import FormBuilder from './components/FormBuilder';
import PropertiesPanel from './components/PropertiesPanel';
import { Eye, UploadCloud, Save, ArrowLeft, Lock } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PreviewWindow from './PreviewWindow'; // Make sure this file exists

export default function App() {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  // Draft: last-saved snapshot (for "Save")
  const [draftFields, setDraftFields] = useState(null);

  // Published: published JSON (for "Publish" lock)
  const [publishedFields, setPublishedFields] = useState(null);

  // If published, disable editing
  const isLocked = !!publishedFields;
  // --- HANDLERS ---

  function handleSave() {
    setDraftFields(fields);
    alert('Form saved as draft in memory (simulate API/localStorage here)');
  }

  function handlePublish() {
    setPublishedFields(fields);
    setSelectedFieldId(null);
    alert('Form published! (Simulate DB/email integration here)');
  }

  function handleUnpublish() {
    setPublishedFields(null);
  }

  function handleRestoreDraft() {
    if (draftFields) setFields(draftFields);
  }

  function handlePreview() {
    localStorage.setItem("formPreviewSchema", JSON.stringify(fields));
    window.open("/preview", "_blank", "width=1200,height=900");
  }

  // --- UI ---
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <DndProvider backend={HTML5Backend}>
              <div className="h-screen w-screen bg-gradient-to-br from-gray-50 to-gray-200 flex flex-col">
                <header className="py-2 px-8 shadow bg-white flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-[#e31837] flex items-center gap-2">
                        🧩 Dynamic Form Builder
                      </span>
                      <div className="flex items-center gap-2">
                        {isLocked && (
                          <span className="ml-3 inline-flex items-center gap-2 text-xs font-bold uppercase rounded-2xl px-4 py-1.5 shadow"
                            style={{
                              background: "#e31837",
                              color: "#fff",
                              letterSpacing: "1px",
                              boxShadow: "0 2px 8px 0 rgba(227,24,55,0.09)"
                            }}>
                            <Lock className="w-4 h-4 mr-1" />
                            Published
                          </span>
                        )}
                        {!isLocked && draftFields && (
                          <span className="ml-3 inline-flex items-center gap-2 text-xs font-bold uppercase rounded-2xl px-4 py-1.5 shadow border"
                            style={{
                              borderColor: "#e31837",
                              background: "#fff",
                              color: "#e31837",
                              letterSpacing: "1px",
                              boxShadow: "0 2px 8px 0 rgba(227,24,55,0.08)"
                            }}>
                            <Save className="w-4 h-4 mr-1" />
                            Draft Saved
                            <button
                              className="ml-3 px-2 py-1 rounded-full font-bold text-xs uppercase"
                              style={{
                                background: "#e31837",
                                color: "#fff",
                                border: "none",
                                boxShadow: "0 1px 3px 0 rgba(227,24,55,0.08)",
                                transition: "background 0.2s"
                              }}
                              onClick={handleRestoreDraft}
                            >
                              Restore
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="hidden md:inline-block text-gray-400 text-xs font-medium">
                      (Drag widgets from the left. Edit properties at right. Set dependencies easily.)
                    </span>
                  </div>
                  <div className="w-full border-b-2 border-[#e31837] mt-2" />
                </header>

                <main className="flex-1 flex gap-6 px-6 py-8 overflow-hidden">
                  {/* Left Sidebar */}
                  {!isLocked && (
                    <aside className="w-[260px] bg-white p-6 rounded-2xl shadow-lg border border-gray-200 flex-shrink-0 flex flex-col">
                      <h2 className="text-xl font-semibold text-gray-700 mb-4">Widgets</h2>
                      <WidgetList />
                    </aside>
                  )}

                  {/* Center Canvas */}
                  <section className="flex-1 min-w-0 bg-white p-6 rounded-2xl shadow-lg border border-gray-200 flex flex-col overflow-y-auto">
                    <div className="mb-6 flex flex-wrap items-center gap-4 justify-between">
                      <div className="flex gap-2">
                        {!isLocked && (
                          <>
                            <button
                              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow"
                              onClick={handlePublish}
                              disabled={fields.length === 0}
                              title="Publish (Lock builder & trigger DB/mail)"
                            >
                              <UploadCloud className="w-5 h-5" />
                              Publish
                            </button>
                            <button
                              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700 shadow"
                              onClick={handleSave}
                              disabled={fields.length === 0}
                              title="Save as Draft (in memory only)"
                            >
                              <Save className="w-5 h-5" />
                              Save
                            </button>
                          </>
                        )}
                        <button
                          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded font-bold border border-gray-300 hover:bg-gray-200"
                          onClick={handlePreview}
                          disabled={fields.length === 0}
                          title="Preview this form in a new window"
                        >
                          <Eye className="w-5 h-5 text-blue-500" />
                          Preview
                        </button>
                        {isLocked && (
                          <button
                            className="ml-4 flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200 font-semibold border"
                            onClick={handleUnpublish}
                            title="Unlock form for editing"
                          >
                            <ArrowLeft className="w-5 h-5" />
                            Unpublish
                          </button>
                        )}
                      </div>
                    </div>
                    <FormBuilder
                      fields={isLocked ? publishedFields : fields}
                      setFields={isLocked ? () => { } : setFields}
                      selectedFieldId={selectedFieldId}
                      setSelectedFieldId={isLocked ? () => { } : setSelectedFieldId}
                      previewMode={false}
                    />
                  </section>

                  {/* Right Sidebar */}
                  {!isLocked && (
                    <aside className="w-[340px] bg-white p-6 rounded-2xl shadow-lg border border-gray-200 flex-shrink-0 overflow-y-auto">
                      <PropertiesPanel
                        fields={fields}
                        setFields={setFields}
                        selectedFieldId={selectedFieldId}
                        setSelectedFieldId={setSelectedFieldId}
                      />
                    </aside>
                  )}
                </main>
              </div>
            </DndProvider>
          }
        />
        <Route path="/preview" element={<PreviewWindow />} />
      </Routes>
    </Router>
  );
}
