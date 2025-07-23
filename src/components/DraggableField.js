import React, { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";

export default function DraggableField({ id, index, moveField, children }) {
  const ref = useRef(null);

  const [, drop] = useDrop({
    accept: "FIELD",
    hover(item, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveField(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{ isDragging }, drag] = useDrag({
    type: "FIELD",
    item: { id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`
    transition-all
    ${isDragging
          ? "border-2 border-[#e31837] bg-[#fff1f3] shadow-xl scale-95 z-50"
          : "border border-transparent"
        }
  `}
      style={{
        cursor: "move",
        pointerEvents: "auto",
        borderRadius: "1rem",
        boxShadow: isDragging ? "0 6px 36px -8px #e3183715" : "0 1px 8px 0 #e3e3e340",
        transition: "all 0.18s cubic-bezier(.35,1.2,.5,1)",
      }}
    >
      {children}
    </div>
  );
}
