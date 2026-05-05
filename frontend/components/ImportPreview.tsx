type ErrorRow = { word: string; reason: string };

type Props = {
  data: {
    added: number;
    updated: number;
    skipped: number;
    errors: ErrorRow[];
  } | null;
};


export function ImportPreview({ data }: Props) {
  if (!data) {
    return <p className="text-slate-400">Загрузите JSON для preview.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded bg-emerald-900/50 p-2">Новые: {data.added}</div>
        <div className="rounded bg-amber-900/50 p-2">Обновления: {data.updated}</div>
        <div className="rounded bg-rose-900/50 p-2">Ошибки/пропуск: {data.skipped}</div>
      </div>

      {data.errors.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-300">
              <th className="py-2">Word</th>
              <th className="py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {data.errors.map((error, idx) => (
              <tr key={`${error.word}-${idx}`} className="border-t border-slate-800">
                <td className="py-2 text-rose-300">{error.word}</td>
                <td className="py-2 text-rose-200">{error.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-emerald-300">Ошибок не найдено.</p>
      )}
    </div>
  );
}

