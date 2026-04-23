import { useState, ReactNode } from 'react';
import { Inbox, LayoutDashboard, FolderKanban, BarChart3, User } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

type Page = 'inbox' | 'board' | 'projects' | 'analytics' | 'profile';

const ReviuLogo = () => (
  <svg width="40" height="40" viewBox="0 0 107 107" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0)">
      <path d="M53.0976 0C82.4227 0 106.195 23.7726 106.195 53.0976C106.195 82.4227 82.4227 106.195 53.0976 106.195C52.4261 106.195 51.7577 106.179 51.0926 106.154C50.899 106.178 50.7018 106.195 50.5015 106.195H4.71864C2.1129 106.194 0.000666283 104.082 0 101.477V55.6937C0 55.4923 0.013562 55.2937 0.0380256 55.099C0.0134123 54.4349 0 53.7677 0 53.0976C0 23.7726 23.7726 0 53.0976 0Z" fill="#F5C430"/>
      <path d="M53.0977 10.6203C76.5572 10.6207 95.5757 29.6386 95.5757 53.0983C95.5754 76.5579 76.5572 95.576 53.0977 95.5764C52.5596 95.5764 52.0233 95.5615 51.4902 95.5417C51.3362 95.5612 51.1794 95.5764 51.0201 95.5764H14.3945C12.3099 95.5764 10.6204 93.8861 10.6196 91.8015V55.1759C10.6196 55.0113 10.6303 54.8477 10.6507 54.6884C10.6313 54.161 10.6197 53.6307 10.6196 53.0983C10.6196 29.6384 29.6377 10.6203 53.0977 10.6203Z" fill="#F5C430"/>
      <circle cx="34.87" cy="52.31" r="6.34" fill="white"/>
      <circle cx="52.31" cy="52.31" r="6.34" fill="white"/>
      <circle cx="69.74" cy="52.31" r="6.34" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0">
        <rect width="106.195" height="106.195" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

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
      <aside className="w-[72px] bg-white border-r border-gray-100 flex flex-col items-center py-5 gap-2">
        {/* Logo */}
        <div className="mb-4">
          <ReviuLogo />
        </div>

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                title={item.label}
                className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </nav>

        {/* Profile at bottom */}
        <button
          onClick={() => setCurrentPage('profile')}
          title="Profile"
          className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-colors ${
            currentPage === 'profile'
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <User size={20} />
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
