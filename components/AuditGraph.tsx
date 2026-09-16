'use client';

interface Props {
  score: number;
}

export default function AuditGraph({ score }: Props) {
  if (score < 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-40 h-40 rounded-full flex items-center justify-center text-sm text-stone-400 border-4 border-dashed border-stone-200 dark:border-stone-700 text-center px-4">
          No data yet
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">Try re-running the audit</p>
      </div>
    );
  }

  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626';

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-40 h-40 rounded-full flex items-center justify-center"
        style={{
          background: `conic-gradient(${color} ${score * 3.6}deg, #e5e7eb 0deg)`,
        }}
      >
        <div className="w-32 h-32 rounded-full bg-white dark:bg-[#14162E] flex items-center justify-center">
          <span className="text-4xl font-extrabold text-stone-900 dark:text-white">
            {score}
          </span>
        </div>
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">AI Visibility Score</p>
    </div>
  );
}