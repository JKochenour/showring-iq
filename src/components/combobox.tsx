"use client";

import { useId, useMemo, useRef, useState, type ComponentProps } from "react";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

export interface ComboboxOption {
  id: string;
  label: string;
}

const MAX_VISIBLE_OPTIONS = 50;

function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options
    .filter((o) => o.label.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.label.localeCompare(b.label);
    });
}

/**
 * A searchable dropdown: type to filter options by substring (prefix matches
 * rank first), arrow keys + Enter to pick, Escape or blur-without-a-match
 * reverts to the last valid selection. Built as a plain controlled
 * value/onChange component (not a native form element) so it's wired up via
 * react-hook-form's <Controller>, not register().
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  onBlur,
  placeholder = "Type to search…",
  emptyText = "No matches",
  disabled,
  clearable = false,
  invalid = false,
}: {
  id?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  invalid?: boolean;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState(selected?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Keep the displayed text in sync when the selected value changes from
  // outside (e.g. form reset) while the field isn't being actively edited.
  // Adjusted during render (React's recommended pattern for this), not an
  // effect, so it can't fire a render after paint or loop on itself.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (!isOpen) setQuery(selected?.label ?? "");
  }

  const filtered = useMemo(() => filterOptions(options, isOpen ? query : ""), [options, query, isOpen]);
  const visible = filtered.slice(0, MAX_VISIBLE_OPTIONS);

  function selectOption(option: ComboboxOption) {
    onChange(option.id);
    setQuery(option.label);
    setIsOpen(false);
  }

  function clearSelection() {
    onChange("");
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleBlur() {
    setIsOpen(false);
    // Revert to the last valid selection if the typed text isn't an exact
    // match (case-insensitive) for any option — free text never becomes
    // the value, only a pick from the list does.
    const exact = options.find((o) => o.label.toLowerCase() === query.trim().toLowerCase());
    if (exact) {
      if (exact.id !== value) onChange(exact.id);
      setQuery(exact.label);
    } else if (query.trim() === "" && clearable) {
      onChange("");
    } else {
      setQuery(selected?.label ?? "");
    }
    onBlur?.();
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 dark:bg-zinc-900 dark:text-zinc-100 ${
            invalid
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-zinc-300 focus:border-emerald-600 focus:ring-emerald-600 dark:border-zinc-700"
          } ${clearable && selected ? "pr-8" : ""}`}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlight(0);
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIsOpen(true);
              setHighlight((h) => Math.min(h + 1, visible.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (isOpen && visible[highlight]) {
                e.preventDefault();
                selectOption(visible[highlight]);
              }
            } else if (e.key === "Escape") {
              setQuery(selected?.label ?? "");
              setIsOpen(false);
            }
          }}
        />
        {clearable && selected && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              clearSelection();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {visible.length === 0 && (
            <li className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{emptyText}</li>
          )}
          {visible.map((option, i) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.id === value}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(option);
              }}
              className={`cursor-pointer px-3 py-1.5 ${
                i === highlight
                  ? "bg-emerald-700 text-white"
                  : option.id === value
                    ? "bg-emerald-50 dark:bg-emerald-950/40"
                    : ""
              }`}
            >
              {option.label}
            </li>
          ))}
          {filtered.length > MAX_VISIBLE_OPTIONS && (
            <li className="border-t border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {filtered.length - MAX_VISIBLE_OPTIONS} more — keep typing to narrow
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Wires a Combobox up to a react-hook-form field, so call sites skip the <Controller> boilerplate. */
export function FormCombobox<T extends FieldValues>({
  control,
  name,
  options,
  ...props
}: {
  control: Control<T>;
  name: Path<T>;
  options: ComboboxOption[];
} & Omit<ComponentProps<typeof Combobox>, "value" | "onChange" | "onBlur" | "options">) {
  const { field } = useController({ control, name });
  return (
    <Combobox
      {...props}
      options={options}
      value={(field.value as string) ?? ""}
      onChange={field.onChange}
      onBlur={field.onBlur}
    />
  );
}
