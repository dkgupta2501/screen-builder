import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { FaFont, FaCheck, FaList, FaDotCircle, FaCloud, FaLink, FaTrash, FaMagic, FaCheckSquare } from "react-icons/fa";

// --- Helpers ---

function flattenFields(fieldsArr) {
  let all = [];
  fieldsArr.forEach(f => {
    if (f.type === 'section' && Array.isArray(f.fields)) {
      all = all.concat(flattenFields(f.fields));
    } else {
      all.push(f);
    }
  });
  return all;
}
function flattenFieldsWithDeps(fieldsArr, parent = null) {
  let all = [];
  fieldsArr.forEach(f => {
    if (f.type === 'section' && Array.isArray(f.fields)) {
      all = all.concat(flattenFieldsWithDeps(f.fields, f.id));
    } else {
      all.push({ ...f, parent });
    }
  });
  return all;
}
function doesFieldDependOn(flatFields, candidateId, currentId, visited = new Set()) {
  if (candidateId === currentId) return true;
  if (visited.has(candidateId)) return false;
  visited.add(candidateId);
  const candidate = flatFields.find(f => f.id === candidateId);
  if (!candidate) return false;
  const depIds = [];
  if (candidate.dependency?.fieldId) depIds.push(candidate.dependency.fieldId);
  if (Array.isArray(candidate.dependsOn)) depIds.push(...candidate.dependsOn);
  for (let depId of depIds) {
    if (depId === currentId) return true;
    if (doesFieldDependOn(flatFields, depId, currentId, visited)) return true;
  }
  return false;
}
function findFieldById(fields, id) {
  for (const field of fields) {
    if (field.id === id) return field;
    if (field.type === 'section' && Array.isArray(field.fields)) {
      const found = findFieldById(field.fields, id);
      if (found) return found;
    }
  }
  return null;
}
function updateFieldById(fields, id, updates) {
  return fields.map(f => {
    if (f.id === id) return { ...f, ...updates };
    if (f.type === 'section' && Array.isArray(f.fields)) {
      return { ...f, fields: updateFieldById(f.fields, id, updates) };
    }
    return f;
  });
}
function deleteFieldById(fields, id) {
  return fields
    .filter(f => f.id !== id)
    .map(f =>
      f.type === 'section' && Array.isArray(f.fields)
        ? { ...f, fields: deleteFieldById(f.fields, id) }
        : f
    );
}

// --- Card UI helper ---
function Card({ icon, title, children, tooltip, className }) {
  return (
    <section className={`bg-white rounded-2xl shadow p-4 mb-5 border border-gray-100 ${className || ''}`}>
      <header className="flex items-center mb-2">
        <span className="text-lg text-blue-500 mr-2">{icon}</span>
        <span className="font-semibold text-gray-700 text-base">{title}</span>
        {tooltip && (
          <span className="ml-2 text-xs text-gray-400" title={tooltip}>ⓘ</span>
        )}
      </header>
      {children}
    </section>
  );
}

export default function PropertiesPanel({
  fields,
  setFields,
  selectedFieldId,
  setSelectedFieldId
}) {
  const field = findFieldById(fields, selectedFieldId);

  // --- Local state for API config, options, etc ---
  const [apiDraft, setApiDraft] = useState(field?.apiConfig || null);
  const [optionSource, setOptionSource] = useState(field?.apiConfig ? "api" : "static");
  const [apiError, setApiError] = useState(null);
  const [apiPreview, setApiPreview] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [paramText, setParamText] = useState(
    field?.apiConfig?.params
      ? JSON.stringify(field.apiConfig.params, null, 2)
      : "{}"
  );
  const [optionInput, setOptionInput] = useState("");

  useEffect(() => {
    setApiDraft(field?.apiConfig || {
      url: "",
      method: "GET",
      params: {},
      mapOptions: { idKey: "", labelKey: "" },
      responsePath: "",
      dependsOn: [],
      responseMap: {}
    });
    setApiPreview([]);
    setApiError(null);
    setApiLoading(false);
    setParamText(
      field?.apiConfig?.params
        ? JSON.stringify(field.apiConfig.params, null, 2)
        : "{}"
    );
    setOptionSource(field?.apiConfig ? "api" : "static");
  }, [field?.id]);

  if (!field) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Properties & Dependencies</h2>
        <p className="text-sm text-gray-500 italic">Select a field to configure...</p>
      </div>
    );
  }

  const updateField = updates => {
    setFields(fields => updateFieldById(fields, field.id, updates));
  };
  const deleteField = () => {
    setFields(fields => deleteFieldById(fields, field.id));
    setSelectedFieldId(null);
  };

  // --- Options editing for dropdown/radio only ---
  const addOption = () => {
    if (optionInput.trim()) {
      updateField({
        options: [
          ...(field.options || []),
          { id: uuidv4(), label: optionInput.trim() }
        ]
      });
      setOptionInput("");
    }
  };
  const editOption = (idx, newLabel) => {
    const newOptions = field.options.map((opt, i) =>
      i === idx ? { ...opt, label: newLabel } : opt
    );
    updateField({ options: newOptions });
  };
  const removeOption = idx => {
    updateField({ options: field.options.filter((_, i) => i !== idx) });
  };

  // --- Params JSON handling ---
  const handleParamTextChange = e => {
    const val = e.target.value;
    setParamText(val);
    try {
      const parsed = JSON.parse(val);
      setApiDraft(d => ({ ...d, params: parsed }));
      setApiError(null);
    } catch {
      setApiError("Params must be valid JSON");
    }
  };

  // --- API Save & Preview ---
  const handleApiSave = async () => {
    // Clean UI-only properties and add safe defaults for arrays/objects
    const cleanedApiDraft = {
      ...apiDraft,
      responseMap: apiDraft.responseMap || {},
      mapOptions: apiDraft.mapOptions || { idKey: "", labelKey: "" },
      params: apiDraft.params || {},
      dependsOn: apiDraft.dependsOn || [],
    };
    delete cleanedApiDraft._newApiKey;
    delete cleanedApiDraft._newFieldId;

    setApiLoading(true);
    setApiError(null);
    setApiPreview([]);
    try {
      const {
        url,
        method = "GET",
        params = {},
        mapOptions = { idKey: "", labelKey: "" },
        responsePath
      } = cleanedApiDraft;

      let realParams = {};
      Object.entries(params).forEach(([key, val]) => {
        if (typeof val === "string") {
          const match = val.match(/^\$\{([a-zA-Z0-9-]+)(?:\.([a-zA-Z0-9_]+))?\}$/);
          if (match) {
            realParams[key] = "";
          } else {
            realParams[key] = val;
          }
        } else {
          realParams[key] = val;
        }
      });

      let response;
      if (method === "POST") {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(realParams)
        });
      } else {
        const qStr = new URLSearchParams(realParams).toString();
        response = await fetch(qStr ? `${url}?${qStr}` : url);
      }
      const json = await response.json();
      let items = json;
      if (responsePath) {
        for (const seg of responsePath.split(".")) {
          items = items?.[seg];
        }
      }
      setApiPreview(items);

      // ------- THE KEY LINE: Populate options property --------
      let options = [];
      if (mapOptions.idKey && mapOptions.labelKey && Array.isArray(items)) {
        options = items.map(item => ({
          id: item[mapOptions.idKey],
          label: item[mapOptions.labelKey],
          ...item
        }));
      } else if (mapOptions.labelKey && Array.isArray(items)) {
        options = items.map(item => ({
          id: item[mapOptions.labelKey],
          label: item[mapOptions.labelKey],
          ...item
        }));
      } else if (mapOptions.idKey && Array.isArray(items)) {
        options = items.map(item => ({
          id: item[mapOptions.idKey],
          label: item[mapOptions.idKey],
          ...item
        }));
      } else if (Array.isArray(items) && typeof items[0] === "string") {
        options = items.map(str => ({ id: str, label: str }));
      }

      // This sets the options in the actual field object immediately!
      updateField({ apiConfig: cleanedApiDraft, options });

      setApiLoading(false);
      setApiError(null);
    } catch (err) {
      setApiError("Failed to fetch API options.");
      setApiPreview([]);
      setApiLoading(false);
    }
  };


  // --- Cycle-safe dependency logic for "Visibility Dependency" only ---
  const flatFields = flattenFieldsWithDeps(fields);
  const dependsOnFieldOptions = flatFields
    .filter(f =>
      f.id !== field.id &&
      !doesFieldDependOn(flatFields, f.id, field.id)
    );
  const depField = field?.dependency
    ? flatFields.find(f => f.id === field.dependency.fieldId)
    : null;

  // --------- RENDER ---------
  // --- ICONS ---
  const icons = {
    text: <FaFont />,
    dropdown: <FaList />,
    radio: <FaDotCircle />,
    checkbox: <FaCheckSquare />,
    section: <FaCheck />,
  };

  return (
    <div className="w-full max-w-full">
      {/* GENERAL */}
      <Card icon={icons[field.type] || <FaCheck />} title="General">
        {/* Label */}
        <div className="mb-4">
          <label className="block font-medium text-gray-600 mb-1">Label</label>
          <input
            className="w-full border rounded px-2 py-1"
            value={field.label || ""}
            onChange={e => updateField({ label: e.target.value })}
          />
        </div>
        {/* Columns (for sections) */}
        {field.type === 'section' && (
          <div className="mb-4">
            <label className="block font-medium text-gray-600 mb-1">Columns</label>
            <input
              type="number"
              min={1}
              max={4}
              className="w-20 border rounded px-2 py-1"
              value={field.columns || 1}
              onChange={e => updateField({ columns: Math.max(1, Math.min(4, Number(e.target.value))) })}
            />
            <div className="text-xs text-gray-400 mt-1">
              Arrange widgets in {field.columns || 1} column(s).
            </div>
          </div>
        )}
        {/* Placeholder (for text) */}
        {field.type === "text" && (
          <div className="mb-4">
            <label className="block font-medium text-gray-600 mb-1">Placeholder</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={field.placeholder || ""}
              onChange={e => updateField({ placeholder: e.target.value })}
            />
          </div>
        )}
        {/* Description */}
        <div className="mb-2">
          <label className="block font-medium text-gray-600 mb-1">Description</label>
          <input
            className="w-full border rounded px-2 py-1"
            value={field.description || ""}
            onChange={e => updateField({ description: e.target.value })}
          />
        </div>
      </Card>

      {/* VALIDATION */}
      {(["text", "dropdown", "date", "checkbox", "switch"].includes(field.type)) && (
        <Card icon={<FaCheck />} title="Validation">
          <div className="flex gap-4 flex-wrap mb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.required || false}
                onChange={e => updateField({ required: e.target.checked })}
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.disabled || false}
                onChange={e => updateField({ disabled: e.target.checked })}
              />
              Disabled
            </label>
            {["text", "date"].includes(field.type) && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.readOnly || false}
                  onChange={e => updateField({ readOnly: e.target.checked })}
                />
                Read Only
              </label>
            )}
            {field.type === "dropdown" && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.readOnly || false}
                    onChange={e => updateField({ readOnly: e.target.checked })}
                  />
                  Read Only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={field.allowMultiple || false}
                    onChange={e => updateField({ allowMultiple: e.target.checked })}
                  />
                  Allow Multiple
                </label>
              </>
            )}
          </div>
          {field.type === "text" && (
            <>
              <div className="flex gap-3 mb-2">
                <div>
                  <label className="block font-medium text-gray-600 mb-1">Min Length</label>
                  <input
                    type="number"
                    min={0}
                    className="w-20 border rounded px-2 py-1"
                    value={field.minLength || ""}
                    onChange={e => updateField({ minLength: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-1">Max Length</label>
                  <input
                    type="number"
                    min={0}
                    className="w-20 border rounded px-2 py-1"
                    value={field.maxLength || ""}
                    onChange={e => updateField({ maxLength: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-gray-600 mb-1">Pattern (RegExp)</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={field.pattern || ""}
                  onChange={e => updateField({ pattern: e.target.value })}
                  placeholder="e.g. ^[A-Za-z ]+$"
                />
              </div>
            </>
          )}
        </Card>
      )}

      {/* OPTIONS SOURCE: Only for Dropdown/Radio */}
      {(field.type === "dropdown" || field.type === "radio" || field.type === "checkbox") && (
        <Card icon={<FaMagic />} title="Options Source" tooltip="Choose static or dynamic options.">
          <div className="mb-3">
            <select
              className="border rounded px-2 py-1"
              value={optionSource}
              onChange={e => {
                const value = e.target.value;
                setOptionSource(value);
                if (value === "static") {
                  updateField({ apiConfig: null });
                } else {
                  setApiDraft({
                    url: "",
                    method: "GET",
                    params: {},
                    mapOptions: { idKey: "", labelKey: "" },
                    responsePath: "",
                    dependsOn: []
                  });
                  updateField({
                    apiConfig: {
                      url: "",
                      method: "GET",
                      params: {},
                      mapOptions: { idKey: "", labelKey: "" },
                      responsePath: "",
                      dependsOn: []
                    },
                    options: []
                  });
                  setParamText("{}");
                }
              }}
            >
              <option value="static">Manual (Static List)</option>
              <option value="api">Dynamic (API)</option>
            </select>
          </div>
          {optionSource === "static" && (
            <>
              <div className="flex mb-2">
                <input
                  className="flex-1 border rounded-l px-2 py-1"
                  placeholder="Add option"
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addOption()}
                />
                <button
                  className="bg-blue-500 text-white px-3 py-1 rounded-r"
                  onClick={addOption}
                  type="button"
                >
                  Add
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {(field.options || []).map((opt, idx) => (
                  <li
                    key={opt.id}
                    className="flex items-center bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs"
                  >
                    <input
                      className="border-b mr-2 bg-transparent"
                      value={opt.label}
                      style={{ width: 75 }}
                      onChange={e => editOption(idx, e.target.value)}
                    />
                    <span className="ml-1 text-gray-400">[{opt.id.slice(0, 4)}]</span>
                    <button
                      className="ml-2 text-red-400 hover:text-red-600"
                      onClick={() => removeOption(idx)}
                      type="button"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {optionSource === "api" && (
            <>
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">API URL</label>
                <input
                  className="w-full border rounded px-2 py-1 mb-1"
                  placeholder="https://api.example.com/list"
                  value={apiDraft?.url || ""}
                  onChange={e => setApiDraft(d => ({ ...d, url: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 mb-2">
                <label className="block text-xs font-medium text-gray-600">Method</label>
                <select
                  className="border rounded px-2 py-1"
                  value={apiDraft?.method || "GET"}
                  onChange={e => setApiDraft(d => ({ ...d, method: e.target.value }))}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-600">
                  Params (JSON)
                </label>
                <textarea
                  className="w-full border rounded px-2 py-1 text-xs"
                  value={paramText}
                  onChange={handleParamTextChange}
                  rows={2}
                />
                {apiError && (
                  <div className="text-red-600 text-xs mt-1">{apiError}</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Use <code>${'{fieldId}'}</code> to interpolate field values.
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 border rounded px-2 py-1"
                  placeholder="ID Key"
                  value={apiDraft?.mapOptions?.idKey || ""}
                  onChange={e =>
                    setApiDraft(d => ({
                      ...d,
                      mapOptions: { ...d.mapOptions, idKey: e.target.value }
                    }))
                  }
                />
                <input
                  className="flex-1 border rounded px-2 py-1"
                  placeholder="Label Key"
                  value={apiDraft?.mapOptions?.labelKey || ""}
                  onChange={e =>
                    setApiDraft(d => ({
                      ...d,
                      mapOptions: { ...d.mapOptions, labelKey: e.target.value }
                    }))
                  }
                />
              </div>
              <input
                className="w-full border rounded px-2 py-1 mb-2"
                placeholder="Response Path (e.g. data.items)"
                value={apiDraft?.responsePath || ""}
                onChange={e => setApiDraft(d => ({ ...d, responsePath: e.target.value }))}
              />
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Depends On (fields)
                </label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={apiDraft?.dependsOn ? apiDraft.dependsOn.join(",") : ""}
                  onChange={e => {
                    const ids = e.target.value
                      .split(",")
                      .map(s => s.trim())
                      .filter(Boolean);
                    setApiDraft(d => ({
                      ...d,
                      dependsOn: ids
                    }));
                  }}
                  placeholder="e.g. stateId, countryId"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Enter field IDs, separated by commas. Will be used in Params as <code>${'{fieldId}'}</code>.
                </div>
              </div>
              <button
                className="bg-blue-600 text-white px-4 py-1 rounded font-semibold hover:bg-blue-700"
                onClick={handleApiSave}
                type="button"
                disabled={apiLoading || !!apiError}
              >
                {apiLoading ? "Saving & Fetching..." : "Save & Fetch Options"}
              </button>
              {(
                // Show only if array with >0, or object with >0 keys (but not if null/empty/false)
                (Array.isArray(apiPreview) && apiPreview.length > 0) ||
                (apiPreview && typeof apiPreview === 'object' && !Array.isArray(apiPreview) && Object.keys(apiPreview).length > 0)
              ) && (
                  <div className="mt-3 text-xs">
                    <div className="font-semibold text-gray-600 mb-1">API Response Preview:</div>
                    <pre className="bg-gray-50 p-2 rounded border border-gray-200 max-h-32 overflow-auto text-xs">
                      {JSON.stringify(apiPreview, null, 2)}
                    </pre>
                  </div>
                )}
            </>
          )}
        </Card>
      )}

      {/* API AUTOFILL for TEXT AND DATE INPUT ONLY */}
      {["text", "date"].includes(field.type) && (
        <Card icon={<FaCloud />} title="API Autofill" tooltip="Configure API to auto-fill other fields when this input changes.">
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">API URL</label>
            <input
              className="w-full border rounded px-2 py-1 mb-1"
              placeholder="https://api.example.com/lookup"
              value={apiDraft?.url || ""}
              onChange={e => setApiDraft(d => ({ ...d, url: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 mb-2">
            <label className="block text-xs font-medium text-gray-600">Method</label>
            <select
              className="border rounded px-2 py-1"
              value={apiDraft?.method || "GET"}
              onChange={e => setApiDraft(d => ({ ...d, method: e.target.value }))}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-600">
              Params (JSON)
            </label>
            <textarea
              className="w-full border rounded px-2 py-1 text-xs"
              value={paramText}
              onChange={handleParamTextChange}
              rows={2}
            />
            {apiError && (
              <div className="text-red-600 text-xs mt-1">{apiError}</div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Use <code>${'{fieldId}'}</code> to interpolate values.
            </div>
          </div>
          {/* --- Response Mapping UI --- */}
          {/* --- Response Mapping UI --- */}
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Response Mapping <span className="text-gray-400">(Map API response to fields)</span>
            </label>
            <div className="space-y-2">
              {/* Mapping List */}
              {Object.keys(apiDraft?.responseMap || {}).length === 0 && (
                <div className="text-xs text-gray-400 italic px-2 py-3 border border-dashed rounded bg-gray-50 mb-2">
                  No mappings yet. Add a response key and select a field below.
                </div>
              )}
              {Object.entries(apiDraft?.responseMap || {}).map(([apiKey, fieldId], idx) => {
                const fieldInfo = flattenFields(fields).find(f => f.id === fieldId);
                return (
                  <div
                    key={apiKey + idx}
                    className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 transition group"
                  >
                    <span className="font-mono text-xs text-blue-700 min-w-[80px]">
                      {apiKey}
                    </span>
                    <span className="mx-1 text-gray-400">→</span>
                    <span className="flex-1 text-sm font-medium text-blue-900 truncate">
                      {fieldInfo?.label || "(field missing)"}{" "}
                      <span className="text-xs text-gray-400">[{fieldId.slice(0, 6)}]</span>
                    </span>
                    <button
                      type="button"
                      className="ml-2 text-red-400 hover:text-red-700 transition p-1"
                      title="Remove mapping"
                      onClick={() => {
                        const newMap = { ...apiDraft.responseMap };
                        delete newMap[apiKey];
                        setApiDraft(d => ({ ...d, responseMap: newMap }));
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {/* Add new mapping row */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-1">
                <input
                  className="border rounded px-2 py-1 flex-1 min-w-0 text-sm"
                  placeholder="API response key (e.g. name)"
                  value={apiDraft?._newApiKey || ""}
                  onChange={e => setApiDraft(d => ({ ...d, _newApiKey: e.target.value }))}
                />
                <select
                  className="border rounded px-2 py-1 flex-1 min-w-0 text-sm"
                  value={apiDraft?._newFieldId || ""}
                  onChange={e => setApiDraft(d => ({ ...d, _newFieldId: e.target.value }))}
                >
                  <option value="">Select field to autofill</option>
                  {flattenFields(fields)
                    .filter(f => ["text", "date"].includes(f.type))
                    .map(f => (
                      <option key={f.id} value={f.id}>
                        {f.label} [{f.id.slice(0, 6)}]
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className={`bg-blue-600 text-white px-4 py-1 rounded font-semibold shadow hover:bg-blue-700 transition ${!(apiDraft?._newApiKey && apiDraft?._newFieldId)
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                    }`}
                  onClick={() => {
                    if (apiDraft._newApiKey && apiDraft._newFieldId) {
                      setApiDraft(d => ({
                        ...d,
                        responseMap: {
                          ...(d.responseMap || {}),
                          [d._newApiKey]: d._newFieldId
                        },
                        _newApiKey: "",
                        _newFieldId: ""
                      }));
                    }
                  }}
                  disabled={!(apiDraft?._newApiKey && apiDraft?._newFieldId)}
                  tabIndex={0}
                >
                  +
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1 ml-1">
                <b>Tip:</b> Add as many mappings as you need. Remove by clicking ×. Fields are auto-filled after API returns!
              </div>
            </div>
          </div>

          <button
            className="bg-blue-600 text-white px-4 py-1 rounded font-semibold hover:bg-blue-700"
            onClick={handleApiSave}
            type="button"
            disabled={apiLoading || !!apiError}
          >
            {apiLoading ? "Saving & Fetching..." : "Save"}
          </button>
          {apiPreview && Object.keys(apiPreview).length > 0 && (
            <div className="mt-3 text-xs">
              <div className="font-semibold text-gray-600 mb-1">API Response Preview:</div>
              <pre className="bg-gray-50 p-2 rounded border border-gray-200 max-h-32 overflow-auto text-xs">
                {JSON.stringify(apiPreview, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}

      {/* DEPENDENCY */}
      <Card icon={<FaLink />} title="Dependency" tooltip="Show this field only when another field matches a value. Prevents cycles.">
        <div className="mb-2">
          <label className="block font-medium text-gray-600 mb-1">Visibility Dependency</label>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              className="border rounded px-2 py-1 flex-1 min-w-0"
              value={field.dependency?.fieldId || ""}
              onChange={e => {
                const depId = e.target.value;
                if (!depId) {
                  updateField({ dependency: null });
                } else {
                  updateField({
                    dependency: {
                      fieldId: depId,
                      value: ""
                    }
                  });
                }
              }}
            >
              <option value="">-- No dependency --</option>
              {dependsOnFieldOptions.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label || f.type}
                </option>
              ))}
            </select>
            {/* Value select/input depending on dep field type */}
            {/* Value select/input depending on dep field type */}
            {depField && (depField.type === "radio" || depField.type === "dropdown") && (
              depField.apiConfig ? (
                <>
                  <input
                    className="border rounded px-2 py-1 flex-1 min-w-0"
                    placeholder="Enter value manually (API-driven field)"
                    value={field.dependency?.value || ""}
                    onChange={e =>
                      updateField({
                        dependency: {
                          fieldId: depField.id,
                          value: e.target.value
                        }
                      })
                    }
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Enter the value as it will appear at runtime.
                  </div>
                </>
              ) : (
                <select
                  className="border rounded px-2 py-1 flex-1 min-w-0"
                  value={field.dependency?.value || ""}
                  onChange={e =>
                    updateField({
                      dependency: {
                        fieldId: depField.id,
                        value: e.target.value
                      }
                    })
                  }
                >
                  <option value="">-- Select value --</option>
                  <option value="*">[Any value selected]</option>
                  {(depField.options || []).map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )
            )}

            {depField && depField.type === "checkbox" && (
              // If static options exist
              (depField.options && depField.options.length > 0 ? (
                <select
                  className="border rounded px-2 py-1 flex-1 min-w-0"
                  value={field.dependency?.value || ""}
                  onChange={e =>
                    updateField({
                      dependency: {
                        fieldId: depField.id,
                        value: e.target.value
                      }
                    })
                  }
                >
                  <option value="">-- Select value --</option>
                  <option value="*">[Any value selected]</option>
                  {(depField.options || []).map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                // If API-driven, ask user to enter option ID manually
                <>
                  <input
                    className="border rounded px-2 py-1 flex-1 min-w-0"
                    placeholder="Option ID to match (see API data)"
                    value={field.dependency?.value || ""}
                    onChange={e =>
                      updateField({
                        dependency: {
                          fieldId: depField.id,
                          value: e.target.value
                        }
                      })
                    }
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    For API-driven checkboxes, enter the option ID from the API response.
                  </div>
                </>
              ))
            )}


            {depField && depField.type === "text" && (
              <input
                className="border rounded px-2 py-1 flex-1 min-w-0"
                placeholder="Value to match"
                value={field.dependency?.value || ""}
                onChange={e =>
                  updateField({
                    dependency: {
                      fieldId: depField.id,
                      value: e.target.value
                    }
                  })
                }
              />
            )}

            {depField && depField.type === "date" && (
              <div className="flex gap-2 w-full">
                <select
                  className="border rounded px-2 py-1 flex-1 min-w-0"
                  value={field.dependency?.value === "*" ? "*" : ""}
                  onChange={e =>
                    updateField({
                      dependency: {
                        fieldId: depField.id,
                        value: e.target.value
                      }
                    })
                  }
                >
                  <option value="">-- Select value --</option>
                  <option value="*">[Any date selected]</option>
                </select>
                <input
                  type="date"
                  className="border rounded px-2 py-1 flex-1 min-w-0"
                  placeholder="YYYY-MM-DD"
                  value={field.dependency?.value && field.dependency?.value !== "*" ? field.dependency.value : ""}
                  onChange={e =>
                    updateField({
                      dependency: {
                        fieldId: depField.id,
                        value: e.target.value
                      }
                    })
                  }
                  disabled={field.dependency?.value === "*"}
                />
              </div>
            )}

            {depField && depField.type === "text" && (
              <input
                className="border rounded px-2 py-1 flex-1 min-w-0"
                placeholder="Value to match"
                value={field.dependency?.value || ""}
                onChange={e =>
                  updateField({
                    dependency: {
                      fieldId: depField.id,
                      value: e.target.value
                    }
                  })
                }
              />
            )}

            {depField && depField.type === "switch" && (
              <select
                className="border rounded px-2 py-1 flex-1 min-w-0"
                value={field.dependency?.value ?? ""}
                onChange={e =>
                  updateField({
                    dependency: {
                      fieldId: depField.id,
                      value: e.target.value === "true" ? true : e.target.value === "false" ? false : ""
                    }
                  })
                }
              >
                <option value="">-- Select value --</option>
                <option value="*">[Any value selected]</option>
                <option value="true">On (true)</option>
                <option value="false">Off (false)</option>
              </select>
            )}


          </div>
          <div className="text-xs text-gray-400 mt-1 break-words max-w-full">
            Show this field only if{" "}
            {depField ? (
              <>
                <b>{depField.label || depField.type}</b> ={" "}
                <b>
                  {(depField.options || []).find(opt => opt.id === field.dependency?.value)?.label || field.dependency?.value || "[value]"}
                </b>
              </>
            ) : (
              "no dependency"
            )}
          </div>
          <div className="mt-1 text-xs text-blue-400">
            <b>Cycle-safe:</b> Can't select fields that would create a direct or indirect circular dependency.
          </div>
        </div>
      </Card>

      {/* DANGER ZONE */}
      <Card
        icon={<FaTrash />}
        title="Danger Zone"
        className="bg-red-50 border-red-200"
      >
        <button
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 w-full font-bold"
          onClick={deleteField} ß
          type="button"
        >
          Delete Field
        </button>
      </Card>
    </div>
  );
}