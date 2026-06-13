import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <div className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
