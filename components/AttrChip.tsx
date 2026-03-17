"use client";

// AttrChip — renders one attribute key:value chip with a localised key.

import { useLanguage } from "@/contexts/LanguageContext";
import { localizeKey, asOfLabel } from "@/lib/utils";

interface Props {
  attrKey: string;
  value: string;
  updatedAt?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function AttrChip({ attrKey, value, updatedAt, style, className }: Props) {
  const { language } = useLanguage();
  const qualifier = updatedAt ? asOfLabel(attrKey, updatedAt, language) : "";
  return (
    <span className={className} style={style}>
      {localizeKey(attrKey, language)}: {value}
      {qualifier && (
        <span className="opacity-60 ml-1">· {qualifier}</span>
      )}
    </span>
  );
}
