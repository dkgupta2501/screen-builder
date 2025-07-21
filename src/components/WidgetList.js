// src/components/WidgetList.js
import React from 'react';
import { useDrag } from 'react-dnd';
import { FaFont, FaDotCircle, FaList, FaFolder ,FaCalendar} from 'react-icons/fa';


const widgets = [
  { type: 'section', label: 'Section', icon: <FaFolder /> },
  { type: 'text', label: 'Text Input', icon: <FaFont /> },
  { type: 'radio', label: 'Radio Button', icon: <FaDotCircle /> },
  { type: 'dropdown', label: 'Dropdown', icon: <FaList /> },
  { type: 'date', label: 'Date Picker', icon: <FaCalendar /> },
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
      className={`flex items-center gap-3 px-4 py-2 rounded-xl border border-gray-300 shadow-sm cursor-move mb-3 text-base font-medium bg-gray-50 hover:bg-gray-100 transition-all ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <span className="text-xl text-gray-500">{icon}</span>
      <span className="text-gray-800">{label}</span>
    </div>
  );
}

export default function WidgetList() {
  return (
    <div className="flex flex-col gap-2">
      {widgets.map((w) => (
        <WidgetItem key={w.type} type={w.type} label={w.label} icon={w.icon} />
      ))}
    </div>
  );
}
