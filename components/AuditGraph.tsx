'use client';

interface Props {
  score: number;
}

export default function AuditGraph({ score }: Props) {
  if (score < 0) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-40 h-40 rounded-full flex items-center justify-center text-sm text-gray-400 border-4 border-dashed border-gray-200 text-center px-4">
          No data yet
        </div>
        <p className="text-sm text-gray-500 mt-2">Try re-running the audit</p>
      </div>
    );
  }

  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626';

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-40 h-40 rounded-full flex items-center justify-center text-3xl font-bold"
        style={{
          background: `conic-gradient(${color} ${score * 3.6}deg, #e5e7eb 0deg)`,
        }}
      >
        <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center">
          {score}
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-2">AI Visibility Score</p>
    </div>
  );
}