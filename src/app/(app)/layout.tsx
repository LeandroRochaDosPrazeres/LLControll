import TabBar from '@/components/navigation/TabBar';
import { ToastProvider } from '@/components/ui';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Main content area */}
        <main className="flex-1 pb-20 overflow-y-auto">
          {children}
        </main>

        {/* Bottom Tab Bar */}
        <TabBar />
      </div>
    </ToastProvider>
  );
}
