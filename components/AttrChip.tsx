"use client";

// AttrChip — renders one attribute key:value chip with a localised key.

import { useLanguage } from "@/contexts/LanguageContext";
import { localizeKey } from "@/lib/utils";

interface Props {
  attrKey: string;
  value: string;
  style?: React.CSSProperties;
  className?: string;
}

export function AttrChip({ attrKey, value, style, className }: Props) {
  const { language } = useLanguage();
  return (
    <span className={className} style={style}>
      {localizeKey(attrKey, language)}: {value}
    </span>
  );
}
