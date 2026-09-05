import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export const SyncStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isSyncing, lastSyncedAt, manualRefresh } = useApp();
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastSyncedAt) {
        const diff = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
        setSecondsAgo(diff);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSyncedAt]);

  const getTimeText = () => {
    if (!lastSyncedAt) return 'Connecting...';
    if (secondsAgo < 3) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.floor(secondsAgo / 60)}m ago`;
  };

  return (
    <button
      onClick={() => manualRefresh()}
      title="Fetches live REST API updates every 10 seconds. Click to sync now."
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 transition-colors shadow-xs"
    >
      <span className="relative flex h-2 w-2">
        {isSyncing ? (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        )}
      </span>

      {!compact ? (
        <>
          <span className="font-semibold">REST Sync (10s)</span>
          <span className="text-emerald-600/80">• {getTimeText()}</span>
          <RefreshCw className={`w-3 h-3 text-emerald-600 ml-0.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </>
      ) : (
        <RefreshCw className={`w-3 h-3 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
      )}
    </button>
  );
};
