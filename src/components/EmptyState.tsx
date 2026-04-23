import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FFFBEB] mb-6">
          <Icon size={32} className="text-[#D4A017]" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
        <p className="text-gray-600 mb-6">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="px-6 py-3 bg-[#F5C430] text-gray-900 rounded-2xl font-semibold hover:bg-[#E8B820] transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
