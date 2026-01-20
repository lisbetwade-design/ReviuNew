import { useState, ReactNode } from 'react';
import { Inbox, LayoutDashboard, FolderKanban, BarChart3, User } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

type Page = 'inbox' | 'board' | 'projects' | 'analytics' | 'profile';

export function Layout({ children }: LayoutProps) {
  const [currentPage, setCurrentPage] = useState<Page>('inbox');

  const menuItems = [
    { id: 'inbox' as Page, label: 'Inbox', icon: Inbox },
    { id: 'board' as Page, label: 'Board', icon: LayoutDashboard },
    { id: 'projects' as Page, label: 'Projects', icon: FolderKanban },
    { id: 'analytics' as Page, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-64 bg-[#F6F7F9] border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inria Sans, sans-serif' }}>
            Reviu
          </h1>
        </div>

        <nav className="flex-1 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-1 transition-colors ${
                  isActive
                    ? 'bg-[#EDEDED] text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => setCurrentPage('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${
              currentPage === 'profile'
                ? 'bg-[#EDEDED] text-gray-900'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <User size={20} />
            <span className="font-medium">Profile</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
