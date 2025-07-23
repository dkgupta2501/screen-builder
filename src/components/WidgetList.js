import React from 'react';
import { useDrag } from 'react-dnd';
import {
  FaFont, FaDotCircle, FaList, FaFolder, FaCalendar, FaCheckSquare,
  FaToggleOn, FaTextHeight, FaTable
} from 'react-icons/fa';

// HDFC ERGO Theme
const ERGO_RED = "#e31837";
const ERGO_BG = "#f5f6fa";
const ERGO_BORDER = "#d9d9d9";
const ERGO_DARK = "#212121";

const widgetCategories = [
  {
    label: "Layout",
    icon: <FaFolder />,
    widgets: [
      { type: "section", label: "Section", icon: <FaFolder /> },
      { type: "table", label: "Table", icon: <FaTable /> }
    ]
  },
  {
    label: "Inputs",
    icon: <FaFont />,
    widgets: [
      { type: "text", label: "Text Input", icon: <FaFont /> },
      { type: "textarea", label: "Textarea", icon: <FaTextHeight /> },
      { type: "date", label: "Date Picker", icon: <FaCalendar /> }
    ]
  },
  {
    label: "Selection",
    icon: <FaList />,
    widgets: [
      { type: "dropdown", label: "Dropdown", icon: <FaList /> },
      { type: "radio", label: "Radio Button", icon: <FaDotCircle /> },
      { type: "checkbox", label: "Checkbox Group", icon: <FaCheckSquare /> },
      { type: "switch", label: "Switch", icon: <FaToggleOn /> }
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
        flex items-center gap-3 px-4 py-2 rounded-lg cursor-move select-none
        bg-white border border-[#d9d9d9]
        text-base font-medium transition
        hover:bg-[#f5f6fa] hover:border-[#e31837] active:bg-[#fde8ed]
        ${isDragging ? 'opacity-30' : ''}
      `}
      style={{ minWidth: 0, fontSize: '1rem', color: ERGO_DARK }}
      tabIndex={0}
      title={label}
    >
      <span className="text-xl" style={{ color: ERGO_RED }}>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function WidgetList() {
  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {widgetCategories.map(cat => (
          <div key={cat.label} className="mb-2">
            {/* HDFC ERGO Themed Category Header */}
            <div className="
              flex items-center gap-2 px-2 py-2 mb-1
              rounded
              font-bold text-xs uppercase tracking-wide
              border-b border-[#e31837] bg-[#e31837]
              shadow
            ">
              <span className="text-lg text-white">{cat.icon}</span>
              <span className="text-white">{cat.label}</span>
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
