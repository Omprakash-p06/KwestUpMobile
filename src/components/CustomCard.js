import React from "react";
import { LiquidGlassCard } from "./LiquidGlassCard";

export const CustomCard = ({ children, style, theme }) => {
  return (
    <LiquidGlassCard style={style} theme={theme}>
      {children}
    </LiquidGlassCard>
  );
};
