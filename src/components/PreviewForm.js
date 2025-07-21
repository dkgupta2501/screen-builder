import React, { useState, useEffect, useRef } from "react";

function interpolateUrl(url, values) {
    return url.replace(/\$\{([^}]+)\}/g, (_, key) => values[key] || "");
  }


// Helper: Validate a single field
function validateField(field, value) {
  if (field.disabled) return null;
  if (field.required && (!value || value.length === 0)) {
    return "This field is required";
  }
  if (field.type === "text") {
    if (field.minLength && value && value.length < field.minLength) {
      return `Minimum ${field.minLength} characters required`;
    }
    if (field.maxLength && value && value.length > field.maxLength) {
      return `Maximum ${field.maxLength} characters allowed`;
    }
    if (field.pattern && value && !new RegExp(field.pattern).test(value)) {
      return "Value does not match the required pattern";
    }
  }
  if (field.type === "dropdown") {
    if (field.required && !value) {
      return "Please select an option";
    }
    if (field.allowMultiple && Array.isArray(value) && field.required && value.length === 0) {
      return "Please select at least one option";
    }
  }
  if (field.type === "radio") {
    if (field.required && !value) {
      return "Please select an option";
    }
  }
  if (field.type === "checkbox") {
    if (field.required && (!value || value.length === 0)) {
      return "Please select at least one option";
    }
  }
  return null;
}

// Helper: Field visibility logic (same as builder)
function isFieldVisible(field, fields, values) {
  if (!field.dependency) return true;
  const depField = fields.find(f => f.id === field.dependency.fieldId);
  if (!depField) return true;
  if (!isFieldVisible(depField, fields, values)) return false;

  const val = values[depField.id];
  const depVal = field.dependency.value;
  if (depVal === "*") {
    if (typeof val === "object" && val !== null) {
      return Object.keys(val).length > 0;
    }
    return val !== undefined && val !== "" && val !== null;
  }
  if (typeof val === "object" && val !== null) {
    return val.id === depVal || val.label === depVal;
  }
  if (depField.type === "checkbox") {
    // If dependency value is '*', show if any selected; else show if value is in selected array
    if (depVal === "*") return Array.isArray(val) && val.length > 0;
    return Array.isArray(val) && val.some(o => o.id === depVal);
  }  
  return val === depVal;
}

// Helper: Flatten all fields inside all sections for validation
function flattenSectionFields(fieldsArr) {
  let all = [];
  fieldsArr.forEach(section => {
    if (section.type === 'section' && Array.isArray(section.fields)) {
      all = all.concat(section.fields);
    }
  });
  return all;
}

// Helper: Recursively flatten all fields inside all sections
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
  
  // Helper: Replace ${parentId.key} or ${parentId} with current value from form state
  function interpolateParams(params, values) {
    let result = {};
    Object.entries(params).forEach(([key, val]) => {
      if (typeof val === "string") {
        // Match ${fieldId} or ${fieldId.key}
        const match = val.match(/^\$\{([a-zA-Z0-9-]+)(?:\.([a-zA-Z0-9_]+))?\}$/);
        if (match) {
          const fieldId = match[1];
          const prop = match[2];
          let fieldVal = values[fieldId];
          if (fieldVal && typeof fieldVal === "object") {
            fieldVal = prop ? fieldVal[prop] ?? "" : fieldVal.id ?? fieldVal.value ?? fieldVal.label ?? "";
          }
          result[key] = fieldVal || "";
        } else {
          result[key] = val;
        }
      } else {
        result[key] = val;
      }
    });
    return result;
  }
  
  

export default function PreviewForm({ fields }) {
  const [values, setValues] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiOptionsMap, setApiOptionsMap] = useState({});
  const [loadingApiOptionsMap, setLoadingApiOptionsMap] = useState({});

  const lastApiCallRef = useRef({});

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
  
  

  // Recursively render all widgets inside all sections
  function renderSections(fieldsArr) {
    return fieldsArr.map(section => {
      if (section.type !== "section") return null;
      return (
        <div
          key={section.id}
          className="mb-8 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl shadow-inner"
        >
          <div className="p-4">
            <div className="text-lg font-bold text-blue-700">{section.label || "Untitled Section"}</div>
            {section.description && (
              <div className="text-sm text-gray-500 mb-2">{section.description}</div>
            )}
            <div className="mt-2 grid gap-6" style={{
    gridTemplateColumns: `repeat(${section.columns || 1}, minmax(0, 1fr))`}}>
              {section.fields && section.fields.map(field => {
                if (!isFieldVisible(field, section.fields, values)) return null;
                const apiOptions = apiOptionsMap[field.id] || [];
                const loadingApiOptions = loadingApiOptionsMap[field.id] || false;
                return (
                  <div key={field.id}>
                    <label className="block font-semibold mb-2 text-gray-700 flex items-center gap-1">
                      {field.label}
                      {field.required ? <span className="text-red-500">*</span> : null}
                    </label>
                    {field.type === "text" && (
                        <input
                            type="text"
                            className={`w-full border rounded px-3 py-2 text-base ${
                            errors[field.id] ? "border-red-500" : ""
                            }`}
                            placeholder={field.placeholder || "Text input"}
                            disabled={field.disabled}
                            readOnly={field.readOnly}
                            minLength={field.minLength || undefined}
                            maxLength={field.maxLength || undefined}
                            required={field.required}
                            value={values[field.id] ?? ""}
                            onChange={e => handleChange(field, e.target.value)}
                            onBlur={async e => {
                            const val = e.target.value;
                            if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                                const allFields = flattenFields(fields);
                                const mergedValues = { ...values, [field.id]: val };
                                const interpolatedUrl = interpolateUrl(field.apiConfig.url, mergedValues);
                                const params = interpolateParams(field.apiConfig.params || {}, mergedValues);
                            
                                try {
                                let response;
                                if (field.apiConfig.method === 'POST') {
                                    response = await fetch(interpolatedUrl, {
                                    method: 'POST',
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(params)
                                    });
                                } else {
                                    const qStr = new URLSearchParams(params).toString();
                                    response = await fetch(qStr ? `${field.apiConfig.url}?${qStr}` : interpolatedUrl);
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


                    {field.type === "date" && (
                      <input
                        type="date"
                        className={`w-full border rounded px-3 py-2 text-base ${errors[field.id] ? "border-red-500" : ""}`}
                        placeholder={field.placeholder || "Select date"}
                        disabled={field.disabled}
                        readOnly={field.readOnly}
                        value={values[field.id] ?? ""}
                        onChange={e => handleChange(field, e.target.value)}
                        onBlur={async e => {
                          const val = e.target.value;
                          if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                            // interpolate params, fetch, map response...
                          }
                        }}
                      />
                    )}


                    {field.type === "radio" && (
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
                                    required={field.required}
                                    onChange={() => handleChange(field, opt)}
                                  />
                                  {opt.label}
                                </label>
                              ))
                          : (field.options || []).map(opt => (
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
                                  required={field.required}
                                  onChange={() => handleChange(field, opt)}
                                />
                                {opt.label}
                              </label>
                            ))
                        }
                      </div>
                    )}
                    {field.type === "dropdown" && (
                      <select
                        disabled={field.disabled}
                        multiple={field.allowMultiple}
                        className={`w-full border rounded px-3 py-2 text-base ${
                          errors[field.id] ? "border-red-500" : ""
                        }`}
                        value={values[field.id] ? JSON.stringify(values[field.id]) : ""}
                        required={field.required}
                        onChange={e => {
                          let value = e.target.value;
                          try { value = JSON.parse(value); } catch {}
                          handleChange(field, value);
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



                    {field.description && (
                      <div className="mt-2 text-xs text-gray-500">{field.description}</div>
                    )}
                    {errors[field.id] && (
                      <div className="text-red-500 text-xs mt-1">{errors[field.id]}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    });
  }

  // Change handler
  function handleChange(field, value) {
    setValues(v => ({ ...v, [field.id]: value }));
    setErrors(e => ({ ...e, [field.id]: null }));
  }

  // Submit/validate
  function handleSubmit(e) {
    e.preventDefault();
    const allFields = flattenSectionFields(fields);
    const visibleFields = [];
    fields.forEach(section => {
      if (section.type === 'section' && Array.isArray(section.fields)) {
        section.fields.forEach(field => {
          if (isFieldVisible(field, section.fields, values)) {
            visibleFields.push(field);
          }
        });
      }
    });
    const newErrors = {};
    visibleFields.forEach(field => {
      const err = validateField(field, values[field.id]);
      if (err) newErrors[field.id] = err;
    });
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      setSubmitted(true);
    }
  }

  return submitted ? (
    <div className="max-w-md mx-auto bg-green-50 p-6 rounded shadow text-center">
      <h2 className="text-2xl font-bold mb-4 text-green-700">Thank you!</h2>
      <div className="text-left text-gray-700 text-sm">
        <div className="mb-2 font-semibold">Form Data:</div>
        <pre className="bg-white p-2 rounded border border-gray-200 mb-4 overflow-auto text-xs" style={{ maxHeight: 120 }}>
          {JSON.stringify(values, null, 2)}
        </pre>
        <div className="mb-2 font-semibold mt-4 flex items-center justify-between">
          Form Builder JSON (Schema):
          <button
            className="ml-2 bg-gray-200 px-2 py-1 rounded text-xs hover:bg-gray-300"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(fields, null, 2));
              alert("Copied to clipboard!");
            }}
          >
            Copy
          </button>
        </div>
        <pre className="bg-white p-2 rounded border border-gray-200 overflow-auto text-xs" style={{ maxHeight: 250 }}>
          {JSON.stringify(fields, null, 2)}
        </pre>
      </div>
      <button
        className="mt-6 bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow"
        onClick={() => setSubmitted(false)}
      >
        Fill Again
      </button>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto flex flex-col gap-6">
      {renderSections(fields)}
      <button
        type="submit"
        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 shadow self-end"
      >
        Submit
      </button>
    </form>
  );
}
