"use client";

import { useEffect, useState } from "react";
import { inputClass } from "./ui";

const zones: string[] =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["America/New_York", "UTC"];

/** Time zone picker; defaults to the browser's zone when no value is given. */
export function TimezoneSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "America/New_York");
  useEffect(() => {
    if (!defaultValue) setValue(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [defaultValue]);
  return (
    <select name={name} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass}>
      {zones.map((z) => (
        <option key={z} value={z}>
          {z.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
