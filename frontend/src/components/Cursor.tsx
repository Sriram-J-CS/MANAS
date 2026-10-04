import React, { useEffect, useRef } from 'react';

interface CursorProps {
  visible: boolean;
  text?: string;
}

export const Cursor: React.FC<CursorProps> = ({ visible, text = 'EXPLORE →' }) => {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    let posX = -999;
    let posY = -999;

    const onPointerMove = (e: PointerEvent) => {
      posX = e.clientX;
      posY = e.clientY;
      cursor.style.left = `${posX}px`;
      cursor.style.top = `${posY}px`;
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  return (
    <div
      ref={cursorRef}
      id="awwwards-cursor"
      className={`${visible ? 'on' : ''} hidden md:block`}
    >
      {text}
    </div>
  );
};
