interface PageHeaderProps {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200">
      <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Inria Sans, sans-serif' }}>
        {title}
      </h2>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-[#2563EB] text-white rounded-2xl font-medium hover:bg-[#1d4ed8] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
