import React from "react";

const MinitakeLogo = ({ size = "md", variant = "light", className = "" }) => {
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  const s = sizes[size] || sizes.md;
  const textColor = variant === "dark" ? "text-white" : "text-gray-900";

  return (
    <span className={`${s} font-bold text-emerald-500 ${className}`}>
      Minitake
    </span>
  );
};

export default MinitakeLogo;
