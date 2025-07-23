import React, { useCallback, useState, useEffect, useRef } from 'react';
import { FaRegCopy } from "react-icons/fa";
import { useDrop } from 'react-dnd';
import { v4 as uuidv4 } from 'uuid';
import DraggableField from './DraggableField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Button from '@mui/material/Button';


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
    <div className={`mb-6 rounded-2xl shadow-md border-2
  ${selectedFieldId === section.id
        ? 'border-[#e31837] bg-gradient-to-br from-[#fff1f3] to-[#f5f6fa]'
        : 'border-[#e3e3e3] bg-white'
      }`}
    >

      <div
        className={`
    p-4 flex items-center justify-between cursor-pointer select-none rounded-t-2xl
    transition-all
    ${selectedFieldId === section.id
            ? 'border-l-4 border-[#e31837] bg-[#fff1f3]'
            : 'border-l-4 border-transparent bg-white'
          }
`}
        onClick={() => setSelectedFieldId(section.id)}
      >
        <div>
          <span className="text-lg font-bold" style={{ color: '#e31837' }}>
            {section.label || 'Untitled Section'}
          </span>
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
                    className={`
                    relative group p-4 border rounded-xl cursor-pointer bg-white shadow transition-all
                    border-gray-200
                    ${isSelected ? 'ring-2 ring-[#e31837]' : ''}
                    ${!normallyVisible && !previewMode ? 'opacity-50' : ''}
                  `}
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

                    {!["radio", "checkbox", "switch"].includes(field.type) && (
                      <label className="block font-semibold mb-2 text-gray-700 flex items-center gap-1">
                        {field.label}
                        {field.required ? (<span className="text-red-500">*</span>) : null}
                      </label>
                    )}


                    {field.type === 'text' && (
                      <TextField
                        fullWidth
                        label={field.label}
                        variant="outlined"
                        size="medium"
                        placeholder={field.placeholder || 'Text input'}
                        disabled={field.disabled}
                        InputProps={{
                          readOnly: field.readOnly,
                          style: {
                            borderRadius: '12px',
                            background: field.disabled ? '#f5f6fa' : '#fff',
                          }
                        }}
                        inputProps={{
                          minLength: field.minLength || undefined,
                          maxLength: field.maxLength || undefined,
                        }}
                        value={values[field.id] ?? ''}
                        onChange={e =>
                          setValues(v => ({ ...v, [field.id]: e.target.value }))
                        }
                        onBlur={async e => {
                          const val = e.target.value;
                          // keep your API autofill logic here (copy from your code)
                          if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                            const allFields = flattenFields(fields);
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
                              const updates = {};
                              for (const [apiKey, targetFieldId] of Object.entries(field.apiConfig.responseMap)) {
                                if (json[apiKey] !== undefined) {
                                  let value = json[apiKey];
                                  const targetField = allFields.find(f => f.id === targetFieldId);
                                  if (targetField?.type === "date") {
                                    if (typeof value === "string" && value.length >= 10) {
                                      value = value.substring(0, 10);
                                    }
                                  }
                                  updates[targetFieldId] = json[apiKey];
                                }
                              }
                              if (Object.keys(updates).length) {
                                setValues(v => ({ ...v, ...updates }));
                              }
                            } catch (err) {
                              // optional: show error
                            }
                          }
                        }}
                        sx={{
                          mt: 0.5,
                          mb: 0.5,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            background: field.disabled ? '#f5f6fa' : '#fff',
                            '& fieldset': {
                              borderColor: selectedFieldId === field.id ? '#e31837' : '#d9d9d9',
                            },
                            '&:hover fieldset': {
                              borderColor: '#e31837',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#e31837',
                              boxShadow: '0 0 0 2px #e3183744'
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#e31837',
                          },
                        }}
                        required={field.required}
                        error={false} // You can set this to true if you have a validation error
                        helperText={field.description || ''}
                      />
                    )}


                    {field.type === 'date' && (
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                          label={field.label || 'Select date'}
                          value={values[field.id] ? new Date(values[field.id]) : null}
                          onChange={date => {
                            // Ensure date is stored as YYYY-MM-DD string
                            const formatted = date
                              ? date.toISOString().substring(0, 10)
                              : '';
                            setValues(v => ({ ...v, [field.id]: formatted }));
                          }}
                          disabled={field.disabled}
                          readOnly={field.readOnly}
                          inputFormat="yyyy-MM-dd"
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              placeholder: field.placeholder || "Select date",
                              variant: "outlined",
                              size: "medium",
                              required: field.required,
                              error: false, // Add your validation here if needed
                              helperText: field.description || "",
                              sx: {
                                mt: 0.5,
                                mb: 0.5,
                                '& .MuiOutlinedInput-root': {
                                  borderRadius: '12px',
                                  background: field.disabled ? '#f5f6fa' : '#fff',
                                  '& fieldset': {
                                    borderColor: selectedFieldId === field.id ? '#e31837' : '#d9d9d9',
                                  },
                                  '&:hover fieldset': {
                                    borderColor: '#e31837',
                                  },
                                  '&.Mui-focused fieldset': {
                                    borderColor: '#e31837',
                                    boxShadow: '0 0 0 2px #e3183744'
                                  },
                                },
                                '& .MuiInputLabel-root.Mui-focused': {
                                  color: '#e31837',
                                },
                              },
                              InputLabelProps: {
                                sx: {
                                  background: "#fff",
                                  px: 0.5,
                                }
                              },
                            }
                          }}
                          onClose={async () => {
                            // Optional: API autofill logic on close or blur
                            const val = values[field.id];
                            if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                              // ... your API autofill logic as before ...
                            }
                          }}
                        />
                      </LocalizationProvider>
                    )}


                    {field.type === 'radio' && (
                      <FormControl
                        component="fieldset"
                        sx={{
                          width: '100%',
                          mt: 0.5,
                          mb: 0.5,
                          '.MuiFormLabel-root': {
                            color: selectedFieldId === field.id ? '#e31837' : '#222',
                            fontWeight: 600,
                          },
                        }}
                        disabled={field.disabled}
                      >
                        <FormLabel component="legend" sx={{
                          '&.Mui-focused': { color: '#e31837' },
                          background: '#fff', px: 0.5, borderRadius: '8px'
                        }}>
                          {field.label}
                        </FormLabel>
                        <RadioGroup
                          row
                          name={field.id}
                          value={
                            values[field.id]
                              ? typeof values[field.id] === "object"
                                ? values[field.id].id
                                : values[field.id]
                              : ""
                          }
                          onChange={e => {
                            const selected = (field.apiConfig ? apiOptions : (field.options || [])).find(opt =>
                              String(opt.id) === e.target.value
                            );
                            setValues(v => ({ ...v, [field.id]: selected }));
                          }}
                          sx={{
                            mt: 1,
                            '& .MuiRadio-root': {
                              color: '#e31837',
                              '&.Mui-checked': { color: '#e31837' },
                            }
                          }}
                        >
                          {(field.apiConfig ? (loadingApiOptions ? [{ id: '', label: 'Loading...' }] : apiOptions) : (field.options || [])).map(opt => (
                            <FormControlLabel
                              key={opt.id}
                              value={opt.id}
                              control={<Radio />}
                              label={opt.label}
                              disabled={field.disabled}
                              sx={{
                                mr: 3,
                                borderRadius: '8px',
                                background: '#fff'
                              }}
                            />
                          ))}
                        </RadioGroup>
                      </FormControl>
                    )}

                    {field.type === 'dropdown' && (
                      <TextField
                        select
                        fullWidth
                        label={field.label}
                        variant="outlined"
                        size="medium"
                        placeholder={field.placeholder || 'Select...'}
                        disabled={field.disabled}
                        value={values[field.id] ? JSON.stringify(values[field.id]) : ""}
                        required={field.required}
                        onChange={e => {
                          let value = e.target.value;
                          try { value = JSON.parse(value); } catch { }
                          setValues(v => ({ ...v, [field.id]: value }));
                        }}
                        InputProps={{
                          readOnly: field.readOnly,
                          style: {
                            borderRadius: '12px',
                            background: field.disabled ? '#f5f6fa' : '#fff',
                          }
                        }}
                        InputLabelProps={{
                          sx: {
                            background: "#fff",
                            px: 0.5,
                          }
                        }}
                        sx={{
                          mt: 0.5,
                          mb: 0.5,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            background: field.disabled ? '#f5f6fa' : '#fff',
                            '& fieldset': {
                              borderColor: selectedFieldId === field.id ? '#e31837' : '#d9d9d9',
                            },
                            '&:hover fieldset': {
                              borderColor: '#e31837',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#e31837',
                              boxShadow: '0 0 0 2px #e3183744'
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#e31837',
                          },
                        }}
                        helperText={field.description || ''}
                      >
                        <MenuItem value="">Select...</MenuItem>
                        {(field.apiConfig ? apiOptions : (field.options || [])).map(opt => (
                          <MenuItem key={opt.id} value={JSON.stringify(opt)}>
                            {opt.year && opt.value ? `${opt.year} - ${opt.value}` : opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}



                    {field.type === 'checkbox' && (
                      <FormControl
                        component="fieldset"
                        sx={{
                          width: '100%',
                          mt: 0.5,
                          mb: 0.5,
                          '.MuiFormLabel-root': {
                            color: selectedFieldId === field.id ? '#e31837' : '#222',
                            fontWeight: 600,
                          },
                        }}
                        disabled={field.disabled}
                      >
                        <FormLabel component="legend" sx={{
                          '&.Mui-focused': { color: '#e31837' },
                          background: '#fff', px: 0.5, borderRadius: '8px'
                        }}>
                          {field.label}
                        </FormLabel>
                        <FormGroup row>
                          {(field.apiConfig ? apiOptions : (field.options || [])).length === 0 ? (
                            <span className="text-xs text-gray-400 ml-2">No options configured.</span>
                          ) : (
                            (field.apiConfig ? apiOptions : (field.options || [])).map(opt => (
                              <FormControlLabel
                                key={opt.id}
                                control={
                                  <Checkbox
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
                                    disabled={field.disabled}
                                    sx={{
                                      color: '#e31837',
                                      '&.Mui-checked': { color: '#e31837' }
                                    }}
                                  />
                                }
                                label={opt.label}
                                sx={{ mr: 3, borderRadius: '8px', background: '#fff' }}
                              />
                            ))
                          )}
                        </FormGroup>
                      </FormControl>
                    )}


                    {field.type === 'textarea' && (
                      <TextField
                        fullWidth
                        label={field.label}
                        multiline
                        minRows={field.rows || 4}
                        maxRows={field.maxRows || 10}
                        placeholder={field.placeholder || 'Enter text'}
                        disabled={field.disabled}
                        InputProps={{
                          readOnly: field.readOnly,
                          style: {
                            borderRadius: '12px',
                            background: field.disabled ? '#f5f6fa' : '#fff',
                          }
                        }}
                        InputLabelProps={{
                          sx: {
                            background: "#fff",
                            px: 0.5,
                          }
                        }}
                        inputProps={{
                          minLength: field.minLength || undefined,
                          maxLength: field.maxLength || undefined,
                        }}
                        value={values[field.id] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                        onBlur={async e => {
                          const val = e.target.value;
                          // API autofill logic...
                          if (field.apiConfig && field.apiConfig.responseMap && field.apiConfig.url) {
                            // ... your API autofill logic from before ...
                          }
                        }}
                        sx={{
                          mt: 0.5,
                          mb: 0.5,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            background: field.disabled ? '#f5f6fa' : '#fff',
                            '& fieldset': {
                              borderColor: selectedFieldId === field.id ? '#e31837' : '#d9d9d9',
                            },
                            '&:hover fieldset': {
                              borderColor: '#e31837',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#e31837',
                              boxShadow: '0 0 0 2px #e3183744'
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#e31837',
                          },
                        }}
                        required={field.required}
                        error={false}
                        helperText={field.description || ''}
                      />
                    )}


                    {field.type === 'switch' && (
                      <FormControl
                        component="fieldset"
                        sx={{
                          width: '100%',
                          mt: 0.5,
                          mb: 0.5,
                          '.MuiFormLabel-root': {
                            color: selectedFieldId === field.id ? '#e31837' : '#222',
                            fontWeight: 600,
                          },
                        }}
                        disabled={field.disabled}
                      >
                        <FormLabel
                          component="legend"
                          sx={{
                            '&.Mui-focused': { color: '#e31837' },
                            background: '#fff',
                            px: 0.5,
                            borderRadius: '8px'
                          }}
                        >
                          {field.label}
                        </FormLabel>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!!values[field.id]}
                              onChange={e => setValues(v => ({ ...v, [field.id]: e.target.checked }))}
                              disabled={field.disabled}
                              sx={{
                                color: '#e31837',
                                '&.Mui-checked': { color: '#e31837' },
                                '& .MuiSwitch-thumb': { backgroundColor: '#e31837' },
                                '& .MuiSwitch-track': {
                                  backgroundColor: !!values[field.id] ? '#e31837' : '#d9d9d9',
                                  opacity: 1,
                                },
                              }}
                              inputProps={{ 'aria-label': field.label }}
                            />
                          }
                          label={!!field.description ? field.description : ""}
                          sx={{ ml: 1 }}
                        />
                      </FormControl>
                    )}


                    {field.type === "table" && (
                      <TableContainer
                        component={Paper}
                        elevation={2}
                        sx={{
                          mt: 2, mb: 2, borderRadius: 3,
                          boxShadow: '0 2px 8px 0 #e3183722',
                          border: `1.5px solid ${selectedFieldId === field.id ? '#e31837' : '#e3e3e3'}`
                        }}
                      >
                        <Table size="small" aria-label={field.label}>
                          <TableHead>
                            <TableRow>
                              {(field.columns || []).map(col => (
                                <TableCell
                                  key={col.id}
                                  sx={{
                                    fontWeight: 700,
                                    color: '#e31837',
                                    background: '#fff1f3',
                                    borderBottom: `2px solid #e31837`,
                                    fontSize: 15,
                                  }}
                                >
                                  {col.label}
                                </TableCell>
                              ))}
                              <TableCell />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(values[field.id] || []).map((row, ridx) => (
                              <TableRow key={ridx} hover>
                                {(field.columns || []).map(col => {
                                  // Dependency logic for cell rendering
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
                                  if (!showCell) return <TableCell key={col.id} />;

                                  // Dropdown column (API/static)
                                  if (col.type === "dropdown") {
                                    const apiOptions = (apiOptionsMap?.[field.id]?.[col.id]?.[ridx]) || [];
                                    const options = col.apiConfig ? apiOptions : (col.options || []);
                                    return (
                                      <TableCell key={col.id}>
                                        <TextField
                                          select
                                          fullWidth
                                          size="small"
                                          value={
                                            typeof row?.[col.id] === "object"
                                              ? row?.[col.id]?.id
                                              : row?.[col.id] || ""
                                          }
                                          onChange={e => {
                                            const selectedOpt = options.find(opt =>
                                              (typeof opt === "object" ? opt.id : opt) === e.target.value
                                            );
                                            const updatedRows = (values[field.id] || []).map((r, i) =>
                                              i === ridx ? { ...r, [col.id]: selectedOpt } : r
                                            );
                                            setValues(v => ({ ...v, [field.id]: updatedRows }));
                                          }}
                                          sx={{
                                            minWidth: 120,
                                            background: '#fff',
                                            '& .MuiOutlinedInput-root': {
                                              borderRadius: 2,
                                              '& fieldset': {
                                                borderColor: '#e31837'
                                              },
                                              '&:hover fieldset': {
                                                borderColor: '#e31837'
                                              },
                                              '&.Mui-focused fieldset': {
                                                borderColor: '#e31837',
                                                boxShadow: '0 0 0 2px #e3183722'
                                              }
                                            }
                                          }}
                                        >
                                          <MenuItem value="">Select</MenuItem>
                                          {options.map(opt =>
                                            typeof opt === "object"
                                              ? <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                                              : <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                          )}
                                        </TextField>
                                      </TableCell>
                                    );
                                  }
                                  // Text column
                                  if (col.type === "text") {
                                    return (
                                      <TableCell key={col.id}>
                                        <TextField
                                          size="small"
                                          value={row?.[col.id] || ""}
                                          onChange={e => {
                                            const updatedRows = (values[field.id] || []).map((r, i) =>
                                              i === ridx ? { ...r, [col.id]: e.target.value } : r
                                            );
                                            setValues(v => ({ ...v, [field.id]: updatedRows }));
                                          }}
                                          sx={{
                                            background: '#fff',
                                            borderRadius: 2,
                                            '& .MuiOutlinedInput-root': {
                                              borderRadius: 2,
                                              '& fieldset': {
                                                borderColor: '#e31837'
                                              },
                                              '&:hover fieldset': {
                                                borderColor: '#e31837'
                                              },
                                              '&.Mui-focused fieldset': {
                                                borderColor: '#e31837',
                                                boxShadow: '0 0 0 2px #e3183722'
                                              }
                                            }
                                          }}
                                        />
                                      </TableCell>
                                    );
                                  }
                                  // Fallback: empty
                                  return <TableCell key={col.id} />;
                                })}
                                <TableCell>
                                  <IconButton
                                    color="error"
                                    size="small"
                                    onClick={() => {
                                      const updatedRows = (values[field.id] || []).filter((_, i) => i !== ridx);
                                      setValues(v => ({ ...v, [field.id]: updatedRows }));
                                    }}
                                    sx={{
                                      color: '#e31837',
                                      '&:hover': { background: '#fff1f3' }
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Add row button */}
                            <TableRow>
                              <TableCell colSpan={(field.columns?.length || 0) + 1} align="left">
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<AddIcon />}
                                  sx={{
                                    background: '#e31837',
                                    color: '#fff',
                                    borderRadius: 2,
                                    px: 2,
                                    py: 0.5,
                                    fontWeight: 500,
                                    fontSize: 14,
                                    minWidth: 0,
                                    textTransform: 'none',
                                    boxShadow: 'none',
                                    '&:hover': { background: '#c31530' }
                                  }}
                                  onClick={() => {
                                    setValues(v => ({
                                      ...v,
                                      [field.id]: [...(v[field.id] || []), {}]
                                    }));
                                  }}
                                >
                                  Add Row
                                </Button>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
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
      className={`
      flex-1 min-h-[400px] flex flex-col items-center justify-start
      border-4 rounded-2xl shadow-2xl
      bg-gradient-to-br
      transition-all
      ${isOver
          ? 'border-[#e31837] from-[#fff1f3] to-[#f5f6fa]'
          : 'border-[#e3e3e3] from-[#f5f6fa] to-[#fff]'
        }
    `}
      style={{
        fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
        fontSize: 17,
      }}
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
