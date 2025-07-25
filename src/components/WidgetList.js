import React from 'react';
import { useDrag } from 'react-dnd';
import {
  FaFont, FaDotCircle, FaList, FaFolder, FaCalendar, FaCheckSquare,
  FaToggleOn, FaTextHeight, FaTable
} from 'react-icons/fa';
 
// Theme colors
const PRIMARY_COLOR = "#e31837";
const BG_COLOR = "#f5f6fa";
const BORDER_COLOR = "#d9d9d9";
const TEXT_COLOR = "#212121";
 
const widgetCategories = [
  {
    label: "Containers",
    icon: <FaFolder />,
    widgets: [
      { type: "section", label: "Workflow Step", icon: <FaFolder /> },
      { type: "table", label: "Table", icon: <FaTable /> }
    ]
  },
  {
    label: "Text Elements",
    icon: <FaFont />,
    widgets: [
      { type: "text", label: "Text Field", icon: <FaFont /> },
      { type: "textarea", label: "Notes", icon: <FaTextHeight /> }
    ]
  },
  {
    label: "Date Elements",
    icon: <FaCalendar />,
    widgets: [
      { type: "date", label: "Date Picker", icon: <FaCalendar /> },
    ]
  },
  {
    label: "Other Elements",
    icon: <FaList />,
    widgets: [
      { type: "dropdown", label: "Dropdown", icon: <FaList /> },
      { type: "radio", label: "Radio", icon: <FaDotCircle /> },
      { type: "checkbox", label: "Checklist", icon: <FaCheckSquare /> },
      { type: "switch", label: "Toggle", icon: <FaToggleOn /> }
    ]
  }
];
 
function WidgetItem({ type, label, icon }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WIDGET',
    item: { type },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));
  return (
    <div
      ref={drag}
      className={`
        flex items-center gap-2 px-3 py-2 cursor-move select-none
        transition-all duration-200
        ${isDragging
          ? 'border border-[#e31837] bg-[#fff1f3] shadow-md scale-105 z-50'
          : 'bg-white border border-[#d9d9d9] hover:bg-[#f5f6fa] hover:border-[#e31837]'
        }
      `}
      style={{
        minWidth: 0,
        fontSize: '0.9rem',
        color: '#212121',
        boxShadow: isDragging
          ? '0 4px 12px -2px rgba(227,24,55,0.2)'
          : '0 1px 3px 0 rgba(0,0,0,0.05)',
        borderRadius: '0.25rem',
        transition: 'all 0.15s ease',
      }}
      tabIndex={0}
      title={label}
    >
      <span className="text-lg" style={{ color: '#e31837' }}>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
 
 
export default function WidgetList() {
  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {widgetCategories.map(cat => (
          <div key={cat.label} className="mb-4">
            <div className="
              flex items-center gap-2 px-2 py-1 mb-2
              font-bold text-xs uppercase tracking-wide
              border-b border-[#e31837]
            ">
              <span className="text-base text-[#e31837]">{cat.icon}</span>
              <span className="text-[#e31837]">{cat.label}</span>
            </div>
            <div className="flex flex-col gap-1">
              {cat.widgets.map(w => (
                <WidgetItem key={w.type} {...w} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}