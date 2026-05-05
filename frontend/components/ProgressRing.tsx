type Props = {
  due: number;
  mastered: number;
};


export function ProgressRing({ due, mastered }: Props) {
  const total = Math.max(1, due + mastered);
  const progress = mastered / total;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  return (
    <div className="flex items-center gap-6 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} stroke="#334155" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#10b981"
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div>
        <p className="text-sm text-slate-400">Mastered / Total</p>
        <p className="text-2xl font-semibold">
          {mastered} / {total}
        </p>
        <p className="text-sm text-slate-400">Due today: {due}</p>
      </div>
    </div>
  );
}

