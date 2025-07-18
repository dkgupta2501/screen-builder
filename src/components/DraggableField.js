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
      className={`transition-all ${isDragging ? "opacity-30" : ""}`}
      style={{ cursor: "move" }}
    >
      {children}
    </div>
  );
}
