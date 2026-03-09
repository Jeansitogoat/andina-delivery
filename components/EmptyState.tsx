'use client';

import type React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-8 gap-3">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
          {icon}
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-rojo-andino text-white text-sm font-semibold hover:bg-rojo-andino/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

