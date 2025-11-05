import React, { useEffect, useState } from "react";

const TypingText = ({ text, speed = 100 }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text[index]);
      index++;
      if (index === text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <p className="notes-updated-exp">{displayedText}</p>;
};

export default TypingText;
