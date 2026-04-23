import { ReactNode } from 'react';
import { LucideIcon, ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: number;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  onBack?: {
    label: string;
    onClick: () => void;
  };
  rightContent?: ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, badge, action, onBack, rightContent }: PageHeaderProps) {
  const ActionIcon = action?.icon;
  return (
    <div className="p-8 border-b border-gray-100">
      {onBack && (
        <button
          onClick={onBack.onClick}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          <span>{onBack.label}</span>
        </button>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            {Icon && (
              <div className="relative">
                <Icon size={26} className="text-gray-700" />
                {badge != null && badge > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#F5C430] rounded-full" />
                )}
              </div>
            )}
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-gray-500 text-sm">{subtitle}</p>
          )}
        </div>
        {rightContent}
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F5C430] text-gray-900 rounded-2xl font-semibold hover:bg-[#E8B820] transition-colors"
          >
            {ActionIcon && <ActionIcon size={18} />}
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
