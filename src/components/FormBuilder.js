import React, { useCallback, useState, useEffect, useRef } from 'react';
import { FaRegCopy } from "react-icons/fa";
import { useDrop } from 'react-dnd';
import { v4 as uuidv4 } from 'uuid';
import DraggableField from './DraggableField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';


function interpolateUrl(url, values) {
  return url.replace(/\$\{([^}]+)\}/g, (_, key) => values[key] || "");
}

function isFieldVisible(field, fields, values) {
  if (!field.dependency) return true;
  const depField = fields.find(f => f.id === field.dependency.fieldId);
  if (!depField) return true;
  if (!isFieldVisible(depField, fields, values)) return false;
  const val = values[depField.id];
  const depVal = field.dependency.value;
  if (depVal === "*") {
    if (typeof val === "object" && val !== null) return Object.keys(val).length > 0;
    return val !== undefined && val !== "" && val !== null;
  }
  if (typeof val === "object" && val !== null) return val.id === depVal || val.label === depVal;
  return val === depVal;
}

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

// Helper: Replace ${fieldId} with the current value (id/label/value) from form values
function interpolateParams(params, values) {
  let result = {};
  Object.entries(params).forEach(([key, val]) => {
    if (typeof val === "string") {
      // Match ${fieldId} or ${fieldId.prop}
      const match = val.match(/^\$\{([a-zA-Z0-9-]+)(?:\.([a-zA-Z0-9_]+))?\}$/);
      if (match) {
        const fieldId = match[1];
        const prop = match[2];
        let fieldVal = values[fieldId];
        // Handle arrays (e.g., checkbox)
        if (Array.isArray(fieldVal)) {
          // By default, if prop, pick from first; if no prop, send array of labels/ids
          if (prop) {
            fieldVal = fieldVal.length > 0 ? fieldVal[0][prop] ?? "" : "";
          } else {
            // Return array of labels if available, else ids, else []
            fieldVal = fieldVal.map(
              (obj) => obj.label ?? obj.id ?? obj.value ?? obj
            );
          }
        } else if (fieldVal && typeof fieldVal === "object") {
          // Object: use prop if present, else label/id/value
          fieldVal = prop
            ? fieldVal[prop] ?? ""
            : fieldVal.label ?? fieldVal.id ?? fieldVal.value ?? "";
        }
        // Primitive (string/number) or null/undefined
        result[key] = fieldVal ?? "";
      } else {
        result[key] = val;
      }
    } else {
      // For non-string param values
      result[key] = val;
    }
  });
  return result;
}



// --- Section Container ---
function SectionContainer({
  section,
  fields,
  setFields,
  selectedFieldId,
  setSelectedFieldId,
  previewMode,
  values,
  setValues,
  apiOptionsMap,
  loadingApiOptionsMap,
}) {
  const [copiedFieldId, setCopiedFieldId] = useState(null);
  // Drop widgets inside this section
  const [{ isOverField }, dropField] = useDrop(() => ({
    accept: 'WIDGET',
    drop: item => {
      if (item.type === 'section') return; // No section-in-section
      const newField = {
        id: uuidv4(),
        type: item.type,
        label: `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Field`,
        options:
          item.type === 'radio' || item.type === 'dropdown' || item.type === 'checkbox'
            ? [
              { id: uuidv4(), label: 'Option 1' },
              { id: uuidv4(), label: 'Option 2' }
            ]
            : [],
        required: false,
        disabled: false,
        description: '',
        placeholder: '',
        minLength: undefined,
        maxLength: undefined,
        pattern: '',
        readOnly: false,
        allowMultiple: false,
        defaultValue: '',
        dependency: null,
        apiConfig: null
      };
      // Always append to the correct section by id!
      setFields(prevSections =>
        prevSections.map(sec =>
          sec.id === section.id
            ? { ...sec, fields: [...(sec.fields || []), newField] }
            : sec
        )
      );
    },
    collect: monitor => ({
      isOverField: !!monitor.isOver()
    })
  }));

  // Drag & drop reordering inside the section
  const moveField = useCallback(
    (from, to) => {
      setFields(prevSections =>
        prevSections.map(sec => {
          if (sec.id !== section.id) return sec;
          const updated = [...(sec.fields || [])];
          const [moved] = updated.splice(from, 1);
          updated.splice(to, 0, moved);
          return { ...sec, fields: updated };
        })
      );
    },
    [section, setFields]
  );

  return (
    <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl shadow-inner">
      <div
        className={`p-4 flex items-center justify-between cursor-pointer select-none ${selectedFieldId === section.id
          ? 'border-blue-600 border-l-4 bg-blue-100'
          : ''
          }`}
        onClick={() => setSelectedFieldId(section.id)}
      >
        <div>
          <span className="text-lg font-bold text-blue-700">{section.label || 'Untitled Section'}</span>
          {section.description && (
            <span className="ml-4 text-sm text-gray-500">{section.description}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">Section</span>
      </div>
      <div
        ref={dropField}
        className={`p-4 min-h-[60px] rounded-xl transition-all bg-white ${isOverField ? 'border-2 border-blue-400 bg-blue-50' : 'border border-gray-200'
          }`}
      >
        {(section.fields && section.fields.length > 0) ? (
          <div className="grid gap-5" style={{
            gridTemplateColumns: `repeat(${section.columns || 1}, minmax(0, 1fr))`
          }}>
            {section.fields.map((field, idx) => {
              const normallyVisible = isFieldVisible(field, section.fields, values);
              const isSelected = field.id === selectedFieldId;
              const apiOptions = apiOptionsMap?.[field.id] || [];
              const loadingApiOptions = loadingApiOptionsMap?.[field.id] || false;

              if (previewMode && !normallyVisible) return null;

              return (
                <DraggableField
                  key={field.id}
                  id={field.id}
                  index={idx}
                  moveField={moveField}
                >
                  <div
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                    }}
                    className={`relative group p-4 border rounded-xl cursor-pointer bg-white shadow transition-all ${isSelected
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-400'
                      } ${!normallyVisible && !previewMode ? 'opacity-50' : ''}`}
                    style={{ pointerEvents: 'auto' }}
                  >
                    {/* Copy Field ID button */}
                    <button
                      type="button"
                      className="absolute top-2 right-2 z-10 text-xs text-gray-400 hover:text-blue-600 bg-white bg-opacity-90 rounded px-1 py-0.5 shadow transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Copy Field ID"
                      onClick={e => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(field.id);

                        setCopiedFieldId(field.id);
                        setTimeout(() => setCopiedFieldId(null), 1000);
                      }}
                    >
                      <FaRegCopy />
                    </button>
                    {copiedFieldId === field.id && (
                      <span className="absolute top-2 right-10 bg-green-500 text-white text-xs px-2 py-1 rounded shadow z-20">
                        Copied!
                      </span>
                    )}
                    <label className="block font-semibold mb-2 text-gray-700 flex items-center gap-1">
                      {field.label}
                      {field.required ? (
                        <span className="text-red-500">*</span>
                      ) : null}
                    </label>
                    {field.type === 'text' && (
                      <input
                        type="text"
                        className="w-full border rounded px-3 py-2 text-base"
                        placeholder={field.placeholder || 'Text input'}
                        disabled={field.disabled}
                        readOnly={field.readOnly}
                        minLength={field.minLength || undefined}
                        maxLength={field.maxLength || undefined}
                        value={values[field.id] ?? ''}
                        onChange={e =>
                          setValues(v => ({ ...v, [field.id]: e.target.value }))
                        }
                        onBlur={async e => {
                          const val = e.target.value;
                          if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                            const allFields = flattenFields(fields);
                            // Use your interpolateParams helper:
                            const params = interpolateParams(field.apiConfig.params || {}, { ...values, [field.id]: val });
                            try {
                              let response;
                              if (field.apiConfig.method === 'POST') {
                                response = await fetch(field.apiConfig.url, {
                                  method: 'POST',
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(params)
                                });
                              } else {
                                const qStr = new URLSearchParams(params).toString();
                                response = await fetch(qStr ? `${field.apiConfig.url}?${qStr}` : field.apiConfig.url);
                              }
                              const json = await response.json();
                              // Apply mapping:
                              const updates = {};
                              for (const [apiKey, targetFieldId] of Object.entries(field.apiConfig.responseMap)) {
                                if (json[apiKey] !== undefined) {
                                  let value = json[apiKey];
                                  // Check if the target field is a date field:
                                  const targetField = allFields.find(f => f.id === targetFieldId);
                                  if (targetField?.type === "date") {
                                    // If it's a datetime string, extract just the date:
                                    if (typeof value === "string" && value.length >= 10) {
                                      value = value.substring(0, 10); // Take 'YYYY-MM-DD'
                                    }
                                  }
                                  updates[targetFieldId] = json[apiKey];
                                }
                              }
                              if (Object.keys(updates).length) {
                                setValues(v => ({ ...v, ...updates }));
                              }
                            } catch (err) {
                              // You can show an error toast or log error here if you want
                            }
                          }
                        }}
                      />
                    )}

                    {field.type === 'date' && (
                      <input
                        type="date"
                        className="w-full border rounded px-3 py-2 text-base"
                        placeholder={field.placeholder || 'Select date'}
                        disabled={field.disabled}
                        readOnly={field.readOnly}
                        value={values[field.id] ?? ""}
                        onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                        onBlur={async e => {
                          const val = e.target.value;
                          // API autofill: same as for text type
                          if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                            // interpolate params, fetch, map response...
                          }
                        }}
                      />
                    )}

                    {field.type === 'radio' && (
                      <div className="flex gap-4">
                        {field.apiConfig
                          ? loadingApiOptions
                            ? <span>Loading...</span>
                            : apiOptions.map(opt => (
                              <label key={opt.id} className="flex items-center gap-2 text-base">
                                <input
                                  type="radio"
                                  name={field.id}
                                  disabled={field.disabled}
                                  checked={
                                    typeof values[field.id] === "object"
                                      ? values[field.id]?.id === opt.id
                                      : values[field.id] === opt.id
                                  }
                                  onChange={() => setValues(v => ({ ...v, [field.id]: opt }))}
                                />
                                {opt.label}
                              </label>
                            ))
                          : (field.options || []).map(opt => (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 text-base"
                            >
                              <input
                                type="radio"
                                name={field.id}
                                disabled={field.disabled}
                                checked={
                                  typeof values[field.id] === "object"
                                    ? values[field.id]?.id === opt.id
                                    : values[field.id] === opt.id
                                }
                                onChange={() => setValues(v => ({ ...v, [field.id]: opt }))}
                              />
                              {opt.label}
                            </label>
                          ))
                        }
                      </div>
                    )}
                    {field.type === 'dropdown' && (
                      <select
                        disabled={field.disabled}
                        multiple={field.allowMultiple}
                        className="w-full border rounded px-3 py-2 text-base"
                        value={values[field.id] ? JSON.stringify(values[field.id]) : ""}
                        required={field.required}
                        onChange={e => {
                          let value = e.target.value;
                          try { value = JSON.parse(value); } catch { }
                          setValues(v => ({ ...v, [field.id]: value }));
                        }}
                        readOnly={field.readOnly}
                      >
                        <option value="">Select...</option>
                        {(field.apiConfig ? apiOptions : (field.options || [])).map(opt => (
                          <option key={opt.id} value={JSON.stringify(opt)}>
                            {opt.year && opt.value ? `${opt.year} - ${opt.value}` : opt.label}
                          </option>
                        ))}
                      </select>
                    )}


                    {field.type === 'checkbox' && (
                      <div className="flex flex-col gap-2">
                        {(field.options || []).length === 0 ? (
                          <span className="text-xs text-gray-400">No options configured.</span>
                        ) : (
                          (field.options || []).map(opt => (
                            <label key={opt.id} className="flex items-center gap-2 text-base">
                              <input
                                type="checkbox"
                                disabled={field.disabled}
                                checked={Array.isArray(values[field.id]) ? values[field.id].some(o => o.id === opt.id) : false}
                                onChange={e => {
                                  setValues(v => {
                                    const current = Array.isArray(v[field.id]) ? [...v[field.id]] : [];
                                    if (e.target.checked) {
                                      return { ...v, [field.id]: [...current, opt] };
                                    } else {
                                      return { ...v, [field.id]: current.filter(o => o.id !== opt.id) };
                                    }
                                  });
                                }}
                              />
                              {opt.label}
                            </label>
                          ))
                        )}
                      </div>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        className="w-full border rounded px-3 py-2 text-base"
                        rows={field.rows || 4}
                        placeholder={field.placeholder || 'Enter text'}
                        disabled={field.disabled}
                        readOnly={field.readOnly}
                        minLength={field.minLength || undefined}
                        maxLength={field.maxLength || undefined}
                        required={field.required}
                        value={values[field.id] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                        onBlur={async e => {
                          const val = e.target.value;
                          // API autofill logic (copy same as text input)
                          if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                            // ...API autofill logic here...
                          }
                        }}
                      />
                    )}


                    {field.type === 'switch' && (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!values[field.id]}
                            onChange={e => setValues(v => ({ ...v, [field.id]: e.target.checked }))}
                            disabled={field.disabled}
                            inputProps={{ 'aria-label': field.label }}
                          />
                        }
                        label={<span className="text-base text-gray-700">{field.label}</span>}
                        sx={{ ml: 0 }} // removes default left margin
                      />
                    )}

                    {field.type === "table" && (
                      <div className="overflow-x-auto mt-2 mb-3">
                        <table className="min-w-full border rounded">
                          <thead>
                            <tr>
                              {(field.columns || []).map(col => (
                                <th key={col.id} className="px-2 py-1 border-b text-left">{col.label}</th>
                              ))}
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(values[field.id] || []).map((row, ridx) => (
                              <tr key={ridx}>
                                {(field.columns || []).map(col => {
                                  // --- Per-column dependency check ---
                                  let showCell = true;
                                  if (col.dependency) {
                                    const depVal = col.dependency.value;
                                    const rowDepVal = row[col.dependency.fieldId];
                                    if (depVal === "*") {
                                      showCell = rowDepVal !== undefined && rowDepVal !== "" && rowDepVal !== null;
                                    } else if (rowDepVal && typeof rowDepVal === "object") {
                                      showCell =
                                        rowDepVal.id === depVal ||
                                        rowDepVal.label === depVal ||
                                        rowDepVal.value === depVal;
                                    } else {
                                      showCell = rowDepVal === depVal;
                                    }
                                  }
                                  if (!showCell) return <td key={col.id}></td>;

                                  // --- Dropdown (API or static) ---
                                  if (col.type === "dropdown") {
                                    // Always use API options if present, else fallback to static
                                    const apiOptions = (apiOptionsMap?.[field.id]?.[col.id]?.[ridx]) || [];
                                    const options = col.apiConfig ? apiOptions : (col.options || []);
                                    return (
                                      <td key={col.id}>
                                        <select
                                          className="border rounded px-2 py-1"
                                          value={
                                            typeof row?.[col.id] === "object"
                                              ? row?.[col.id]?.id
                                              : row?.[col.id] || ""
                                          }
                                          onChange={e => {
                                            // Find the option object by ID
                                            const selectedOpt = options.find(opt =>
                                              (typeof opt === "object" ? opt.id : opt) === e.target.value
                                            );
                                            const updatedRows = (values[field.id] || []).map((r, i) =>
                                              i === ridx ? { ...r, [col.id]: selectedOpt } : r
                                            );
                                            setValues(v => ({ ...v, [field.id]: updatedRows }));
                                          }}
                                          required={!!col.required}
                                        >
                                          <option value="">Select</option>
                                          {options.map(opt =>
                                            typeof opt === "object"
                                              ? <option key={opt.id} value={opt.id}>{opt.label}</option>
                                              : <option key={opt} value={opt}>{opt}</option>
                                          )}
                                        </select>
                                      </td>
                                    );
                                  }

                                  // --- Text ---
                                  if (col.type === "text") {
                                    return (
                                      <td key={col.id}>
                                        <input
                                          className="border rounded px-2 py-1"
                                          value={row?.[col.id] || ""}
                                          onChange={e => {
                                            const updatedRows = (values[field.id] || []).map((r, i) =>
                                              i === ridx ? { ...r, [col.id]: e.target.value } : r
                                            );
                                            setValues(v => ({ ...v, [field.id]: updatedRows }));
                                          }}
                                          required={!!col.required}
                                        />
                                      </td>
                                    );
                                  }


                                  // --- Fallback: empty cell ---
                                  return <td key={col.id}></td>;
                                })}
                                {/* Row delete button */}
                                <td>
                                  <button
                                    className="text-red-600 px-2"
                                    type="button"
                                    onClick={() => {
                                      const updatedRows = (values[field.id] || []).filter((_, i) => i !== ridx);
                                      setValues(v => ({ ...v, [field.id]: updatedRows }));
                                    }}
                                  >×</button>
                                </td>
                              </tr>
                            ))}
                            {/* Add row button */}
                            <tr>
                              <td colSpan={(field.columns?.length || 0) + 1}>
                                <button
                                  className="bg-green-500 text-white px-3 py-1 rounded"
                                  type="button"
                                  onClick={() => {
                                    setValues(v => ({
                                      ...v,
                                      [field.id]: [...(v[field.id] || []), {}]
                                    }));
                                  }}
                                >+ Add Row</button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {field.description && (
                      <div className="mt-2 text-xs text-gray-500">
                        {field.description}
                      </div>
                    )}
                  </div>
                </DraggableField>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-4">Drag widgets here to add to this section</p>
        )}
      </div>
    </div>
  );
}

// --- MAIN FORM BUILDER ---
export default function FormBuilder({
  fields,
  setFields,
  selectedFieldId,
  setSelectedFieldId,
  previewMode
}) {
  const [values, setValues] = useState({});
  const [apiOptionsMap, setApiOptionsMap] = useState({});
  const [loadingApiOptionsMap, setLoadingApiOptionsMap] = useState({});
  const lastApiCallRef = useRef({});

  // Drag-n-drop: Move sections at the root level
  const moveSection = useCallback(
    (from, to) => {
      setFields(prevFields => {
        const updated = [...prevFields];
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        return updated;
      });
    },
    [setFields]
  );

  // Only accept section drop at root
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'WIDGET',
    drop: item => {
      if (item.type === 'section') {
        const newSection = {
          id: uuidv4(),
          type: 'section',
          label: 'Untitled Section',
          description: '',
          columns: 1, // <--- Add this line!
          fields: []
        };
        setFields(prev => [...prev, newSection]);
      }
    },
    collect: monitor => ({
      isOver: !!monitor.isOver()
    })
  }));

  // Update section
  const updateSection = (sectionIdx, updatedSection) => {
    setFields(fields =>
      fields.map((f, i) => (i === sectionIdx ? updatedSection : f))
    );
  };

  useEffect(() => {
    // Loop through each field (section), find tables
    flattenFields(fields).forEach(field => {
      if (field.type === "table") {
        // For each API-config dropdown column
        (field.columns || []).forEach(col => {
          if (col.type === "dropdown" && col.apiConfig) {
            // For each row in the table
            (values[field.id] || []).forEach((row, ridx) => {
              // Interpolate params from this row
              const params = { ...(col.apiConfig.params || {}) };
              Object.keys(params).forEach(k => {
                if (typeof params[k] === "string" && params[k].includes("${")) {
                  const match = params[k].match(/\$\{([^}]+)\}/);
                  if (match) {
                    const depColExpr = match[1];
                    if (depColExpr.includes('.')) {
                      const [colId, prop] = depColExpr.split('.');
                      params[k] = row[colId]?.[prop] || "";
                    } else {
                      params[k] = row[depColExpr] || "";
                    }
                  }
                }
              });
              console.log("CITY API", col.label, "params", params, "row", ridx);
              // Only fetch if required param present
              if (Object.values(params).some(v => v === "")) {
                setApiOptionsMap(prev => ({
                  ...prev,
                  [field.id]: {
                    ...(prev[field.id] || {}),
                    [col.id]: { ...(prev[field.id]?.[col.id] || {}), [ridx]: [] }
                  }
                }));
                return;
              }
              // Fetch!
              const url = col.apiConfig.url;
              const method = col.apiConfig.method || "GET";
              const fetchOptions = async () => {
                try {
                  let response;
                  if (method === "POST") {
                    response = await fetch(url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(params)
                    });
                  } else {
                    const qStr = new URLSearchParams(params).toString();
                    response = await fetch(qStr ? `${url}?${qStr}` : url);
                  }
                  const json = await response.json();
                  let items = json;
                  if (col.apiConfig.responsePath) {
                    for (const seg of col.apiConfig.responsePath.split(".")) {
                      items = items?.[seg];
                    }
                  }
                  // Map options
                  let mapped = [];
                  const { idKey, labelKey } = col.apiConfig.mapOptions || {};
                  if (idKey && labelKey) {
                    mapped = Array.isArray(items)
                      ? items.map(item => ({
                        id: item[idKey],
                        label: item[labelKey],
                        ...item
                      }))
                      : [];
                  } else if (labelKey) {
                    mapped = Array.isArray(items)
                      ? items.map(item => ({
                        id: item[labelKey],
                        label: item[labelKey],
                        ...item
                      }))
                      : [];
                  } else if (idKey) {
                    mapped = Array.isArray(items)
                      ? items.map(item => ({
                        id: item[idKey],
                        label: item[idKey],
                        ...item
                      }))
                      : [];
                  } else if (Array.isArray(items) && typeof items[0] === "string") {
                    mapped = items.map(str => ({ id: str, label: str }));
                  }
                  // Store in cache
                  setApiOptionsMap(prev => ({
                    ...prev,
                    [field.id]: {
                      ...(prev[field.id] || {}),
                      [col.id]: {
                        ...(prev[field.id]?.[col.id] || {}),
                        [ridx]: mapped
                      }
                    }
                  }));
                } catch (err) {
                  setApiOptionsMap(prev => ({
                    ...prev,
                    [field.id]: {
                      ...(prev[field.id] || {}),
                      [col.id]: {
                        ...(prev[field.id]?.[col.id] || {}),
                        [ridx]: []
                      }
                    }
                  }));
                }
              };
              fetchOptions();
            });
          }
        });
      }
    });
  }, [fields, values]);

  useEffect(() => {
    const allFields = flattenFields(fields);

    allFields.forEach(field => {
      if (field.apiConfig && (field.type === "dropdown" || field.type === "radio" || field.type === "checkbox")) {
        const {
          url,
          method = "GET",
          params = {},
          mapOptions = {},
          responsePath,
          dependsOn = []
        } = field.apiConfig;

        const realParams = interpolateParams(params, values);

        // Generate a hash for current params and dependsOn values
        const paramsHash = JSON.stringify(realParams);
        const dependsHash = JSON.stringify((dependsOn || []).map(depId => values[depId]));
        const fieldHash = paramsHash + "|" + dependsHash;

        // Compare with last called hash
        if (lastApiCallRef.current[field.id] === fieldHash) {
          // No need to call API again
          return;
        }

        // Do not call API if any dependsOn value is missing
        if (
          Array.isArray(dependsOn) &&
          dependsOn.some(depId => {
            const v = values[depId];
            return v === undefined || v === null || v === "" || (typeof v === "object" && Object.keys(v).length === 0);
          })
        ) {
          setApiOptionsMap(prev => ({ ...prev, [field.id]: [] }));
          setLoadingApiOptionsMap(prev => ({ ...prev, [field.id]: false }));
          return;
        }

        // Save the new hash to prevent duplicate API calls
        lastApiCallRef.current[field.id] = fieldHash;
        setLoadingApiOptionsMap(prev => ({ ...prev, [field.id]: true }));

        const fetchOptions = async () => {
          try {
            let response;
            const interpolatedUrl = interpolateUrl(url, values);
            if (method === "POST") {
              response = await fetch(interpolatedUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(realParams)
              });
            } else {
              const qStr = new URLSearchParams(realParams).toString();
              response = await fetch(qStr ? `${url}?${qStr}` : interpolatedUrl);
            }
            const json = await response.json();
            let items = json;
            if (responsePath) {
              for (const seg of responsePath.split(".")) {
                items = items?.[seg];
              }
            }
            let mapped;
            if (mapOptions.idKey && mapOptions.labelKey) {
              mapped = Array.isArray(items)
                ? items.map(item => ({
                  id: item[mapOptions.idKey],
                  label: item[mapOptions.labelKey],
                  ...item
                }))
                : [];
            } else if (mapOptions.labelKey) {
              mapped = Array.isArray(items)
                ? items.map(item => ({
                  id: item[mapOptions.labelKey],
                  label: item[mapOptions.labelKey],
                  ...item
                }))
                : [];
            } else if (mapOptions.idKey) {
              mapped = Array.isArray(items)
                ? items.map(item => ({
                  id: item[mapOptions.idKey],
                  label: item[mapOptions.idKey],
                  ...item
                }))
                : [];
            } else if (Array.isArray(items) && typeof items[0] === "string") {
              mapped = items.map(str => ({ id: str, label: str }));
            } else {
              mapped = [];
            }
            setApiOptionsMap(prev => ({ ...prev, [field.id]: mapped }));
          } catch {
            setApiOptionsMap(prev => ({ ...prev, [field.id]: [] }));
          } finally {
            setLoadingApiOptionsMap(prev => ({ ...prev, [field.id]: false }));
          }
        };

        fetchOptions();
      }
    });
  }, [
    JSON.stringify(fields),
    // Trigger ONLY when any relevant field value for apiConfig fields changes
    ...flattenFields(fields)
      .filter(f => f.apiConfig && f.apiConfig.dependsOn && f.apiConfig.dependsOn.length)
      .flatMap(f => f.apiConfig.dependsOn.map(depId => values[depId])),
    JSON.stringify(values)
  ]);





  // --- MAIN RENDER ---
  return (
    <div
      ref={drop}
      className={`flex-1 min-h-[400px] flex flex-col items-center justify-start border-4 border-dashed rounded-2xl shadow-inner transition bg-gradient-to-br ${isOver
        ? 'border-blue-400 from-blue-50 to-blue-100'
        : 'border-gray-200 from-white to-gray-50'
        }`}
    >
      {fields.length === 0 ? (
        <p className="text-gray-400 text-lg text-center mt-16">
          {isOver
            ? '✨ Release to add a Section!'
            : 'Drag a Section here to start your form'}
        </p>
      ) : (
        <div className="w-full flex flex-col gap-5">
          {fields.map((section, idx) => (
            <SectionContainer
              key={section.id}
              section={section}
              fields={fields}                   // <-- NEW: pass root fields
              setFields={setFields}             // <-- NEW: pass setFields function!
              selectedFieldId={selectedFieldId}
              setSelectedFieldId={setSelectedFieldId}
              previewMode={previewMode}
              values={values}
              setValues={setValues}
              apiOptionsMap={apiOptionsMap}
              loadingApiOptionsMap={loadingApiOptionsMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
