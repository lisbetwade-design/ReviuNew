import { useState, useEffect } from 'react';
import { LayoutDashboard, Search, Filter, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { supabase } from '../lib/supabase';

interface BoardItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  stakeholder_role: string | null;
  project_id: string | null;
  created_at: string;
  project?: {
    name: string;
  };
}

const columns = [
  { id: 'open', label: 'Open', fg: '#C10007', bg: '#FEF2F2' },
  { id: 'in_progress', label: 'In Progress', fg: '#1447E6', bg: '#EFF6FF' },
  { id: 'under_review', label: 'Under Review', fg: '#A65F00', bg: '#FEFCE8' },
  { id: 'resolved', label: 'Resolved', fg: '#00786F', bg: '#D1FAE5' },
];

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export function BoardPage() {
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  useEffect(() => {
    loadBoardItems();
  }, []);

  const loadBoardItems = async () => {
    try {
      const { data, error } = await supabase
        .from('board_items')
        .select(`
          *,
          project:projects(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoardItems(data || []);
    } catch (error) {
      console.error('Error loading board items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getItemsByStatus = (status: string) => {
    return boardItems.filter((item) => item.status === status);
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', itemId);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();

    if (!draggedItem) return;

    const item = boardItems.find((i) => i.id === draggedItem);
    if (!item || item.status === newStatus) {
      setDraggedItem(null);
      setDraggedOverColumn(null);
      return;
    }

    setBoardItems((prevItems) =>
      prevItems.map((i) => (i.id === draggedItem ? { ...i, status: newStatus } : i))
    );

    setDraggedItem(null);
    setDraggedOverColumn(null);

    try {
      const { error } = await supabase
        .from('board_items')
        .update({ status: newStatus })
        .eq('id', draggedItem);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating item status:', error);
      alert('Failed to update item status. Please try again.');
      loadBoardItems();
    }
  };

  if (loading) {
    return (
      <div className="h-full">
        <PageHeader title="Board" />
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (boardItems.length === 0 && !searchQuery) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader title="Board" />
        <EmptyState
          icon={LayoutDashboard}
          title="No items on your board yet"
          description="Convert feedback from your inbox into actionable items that you can track through completion."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Board"
        action={{
          label: 'New Item',
          onClick: () => console.log('New item')
        }}
      />

      <div className="px-8 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Filter size={20} />
            <span className="font-medium">Filters</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-4 gap-6 h-full">
          {columns.map((column) => {
            const items = getItemsByStatus(column.id);
            const isDropTarget = draggedOverColumn === column.id;
            return (
              <div key={column.id} className="flex flex-col">
                <div
                  className="flex items-center justify-between mb-4 px-4 py-3 rounded-xl transition-colors"
                  style={{ backgroundColor: column.bg }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: column.fg }}
                    />
                    <h3 className="font-semibold" style={{ color: column.fg }}>{column.label}</h3>
                    <span className="text-sm" style={{ color: column.fg, opacity: 0.7 }}>({items.length})</span>
                  </div>
                  <button
                    className="transition-opacity hover:opacity-70"
                    style={{ color: column.fg }}
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div
                  className={`flex-1 space-y-3 min-h-[200px] p-3 rounded-2xl transition-all ${
                    isDropTarget ? 'bg-blue-50 ring-2 ring-blue-300 ring-opacity-50' : 'bg-transparent'
                  }`}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing ${
                        draggedItem === item.id ? 'opacity-50 scale-95' : 'opacity-100'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 flex-1 pr-2">{item.title}</h4>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${priorityColors[item.priority]}`}>
                          {item.priority}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                      )}
                      {item.project && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <div className="w-2 h-2 bg-gray-300 rounded-full" />
                          <span>{item.project.name}</span>
                        </div>
                      )}
                      {item.stakeholder_role && (
                        <div className="mt-2 text-xs text-gray-500 italic">
                          {item.stakeholder_role}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                      {isDropTarget ? 'Drop here' : 'No items'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
