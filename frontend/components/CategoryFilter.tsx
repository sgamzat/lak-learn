"use client";

type Props = {
  values: string[];
  active: string | null;
  onChange: (value: string | null) => void;
};


export function CategoryFilter({ values, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`rounded-full px-3 py-1 text-sm ${active === null ? "bg-slate-600" : "bg-slate-800"}`}
      >
        Все
      </button>
      {values.map((value) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`rounded-full px-3 py-1 text-sm ${active === value ? "bg-slate-600" : "bg-slate-800"}`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

