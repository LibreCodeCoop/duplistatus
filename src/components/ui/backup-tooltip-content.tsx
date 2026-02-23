"use client";

import { useRouter } from 'next/navigation';
import type { BackupStatus, NotificationEvent } from "@/lib/types";
import { formatRelativeTime, formatBytes, getStatusColor } from "@/lib/utils";
import { AlertTriangle, Settings, MessageSquareMore, MessageSquareOff, Trash2 } from "lucide-react";
import { ServerConfigurationButton } from "@/components/ui/server-configuration-button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { authenticatedRequestWithRecovery } from "@/lib/client-session-csrf";
import { useGlobalRefresh } from "@/contexts/global-refresh-context";
import { useState } from "react";

// Helper function to get notification icon
function getNotificationIcon(notificationEvent: NotificationEvent | undefined) {
  if (!notificationEvent) return null;
  
  switch (notificationEvent) {
    case 'errors':
      return <MessageSquareMore className="h-4 w-4 text-red-400" />;
    case 'warnings':
      return <MessageSquareMore className="h-4 w-4 text-yellow-400" />;
    case 'all':
      return <MessageSquareMore className="h-4 w-4 text-blue-400" />;
    case 'off':
      return <MessageSquareOff className="h-4 w-4 text-gray-400" />;
    default:
      return null;
  }
}

interface BackupTooltipContentProps {
  serverId: string;
  serverAlias?: string;
  serverName: string;
  serverNote?: string;
  serverUrl: string;
  backupName: string;
  lastBackupDate: string;
  lastBackupStatus: BackupStatus | 'N/A';
  lastBackupDuration: string;
  lastBackupListCount: number | null;
  fileCount: number;
  fileSize: number;
  storageSize: number;
  uploadedSize: number;
  isOverdue: boolean;
  expectedBackupDate: string;
  notificationEvent?: NotificationEvent;
}

export function BackupTooltipContent({
  serverId,
  serverAlias,
  serverName,
  serverNote,
  serverUrl,
  backupName,
  lastBackupDate,
  lastBackupStatus,
  lastBackupDuration,
  lastBackupListCount,
  fileCount,
  fileSize,
  storageSize,
  uploadedSize,
  isOverdue,
  expectedBackupDate,
  notificationEvent,
}: BackupTooltipContentProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { toast } = useToast();
  const { refreshDashboard } = useGlobalRefresh();
  const [isDeletingBackupJob, setIsDeletingBackupJob] = useState(false);

  const handleDeleteBackupJob = async () => {
    if (isDeletingBackupJob) return;

    try {
      setIsDeletingBackupJob(true);

      const response = await authenticatedRequestWithRecovery('/api/backups/delete-job', {
        method: 'DELETE',
        body: JSON.stringify({
          serverId,
          backupName,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to delete backup job');
      }

      toast({
        title: `Backup job "${backupName}" deleted`,
        description: result.message || 'Backup job deleted successfully.',
        duration: 3000,
      });

      await refreshDashboard();
      window.dispatchEvent(new CustomEvent('configuration-saved'));
    } catch (error) {
      toast({
        title: `Backup job "${backupName}" deletion failed`,
        description: error instanceof Error ? error.message : 'Failed to delete backup job.',
        variant: 'destructive',
        duration: 3500,
      });
    } finally {
      setIsDeletingBackupJob(false);
    }
  };

  return (
    <>
      <div className="font-bold text-sm text-left flex items-center justify-between">
        <span>{serverAlias || serverName} : {backupName}</span>
        {notificationEvent && (
          <div className="inline-block mr-2">
            {getNotificationIcon(notificationEvent)}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground text-left -mt-3 truncate">
        {serverAlias ? serverName : ''}{serverAlias && serverNote ? <br/> : ''}{serverNote ? serverNote : ''}
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="text-bold mb-4">Last Backup Details</div>
        
        <div className="grid grid-cols-[65%_35%] gap-x-3 gap-y-2 text-xs">
          <div>
            <div className="text-muted-foreground text-left mb-1">Date:</div>
            <div className="font-semibold text-left">
              {lastBackupDate !== "N/A" 
                ? new Date(lastBackupDate).toLocaleString() + " (" + formatRelativeTime(lastBackupDate) + ")"
                : "N/A"}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-left mb-1">Status:</div>
            <div className={`font-semibold text-left ${getStatusColor(lastBackupStatus)}`}>
              {lastBackupStatus !== "N/A" 
                ? lastBackupStatus
                : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-left mb-1">Duration:</div>
            <div className="font-semibold text-left">
              {lastBackupDuration !== null && lastBackupDuration !== undefined
                ? lastBackupDuration
                : "N/A"}
            </div>
          </div>
                                                
          <div>
            <div className="text-muted-foreground text-left mb-1">Files:</div>
            <div className="font-semibold text-left">
              {fileCount !== null && fileCount !== undefined
                ? fileCount.toLocaleString()
                : "N/A"}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-left mb-1">Size:</div>
            <div className="font-semibold text-left">
              {fileSize !== null && fileSize !== undefined
                ? formatBytes(fileSize)
                : "N/A"}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-left mb-1">Storage:</div>
            <div className="font-semibold text-left">
              {storageSize !== null && storageSize !== undefined
                ? formatBytes(storageSize)
                : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-left mb-1">Uploaded:</div>
            <div className="font-semibold text-left">
              {uploadedSize !== null && uploadedSize !== undefined
                ? formatBytes(uploadedSize)
                : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-left mb-1">Versions:</div>
            <div className="font-semibold text-left">
              {lastBackupListCount !== null && lastBackupListCount !== undefined
                ? lastBackupListCount.toLocaleString()
                : "N/A"}
            </div>
          </div>
          
          {/* Expected backup date for non-overdue backups */}
          {!isOverdue && expectedBackupDate !== "N/A" && (
            <div className="col-span-2">
              <div className="text-muted-foreground text-left mb-1">Expected:</div>
              <div className="font-semibold text-left">
                {new Date(expectedBackupDate).toLocaleString() + " (" + formatRelativeTime(expectedBackupDate) + ")"}
              </div>
            </div>
          )}
        </div>
      </div>
        
      {/* Overdue information section */}
      {isOverdue && (
        <div className="border-t pt-3 space-y-3">
          <div className="font-semibold text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Backup Overdue
          </div>
          
          <div className="grid grid-cols-[80px_1fr] gap-x-3 text-xs">
            <div className="text-muted-foreground text-right">Expected:</div>
            <div className="font-semibold text-left">
              {expectedBackupDate !== "N/A" 
                ? new Date(expectedBackupDate).toLocaleString() + " (" + formatRelativeTime(expectedBackupDate) + ")"
                : "N/A"}
            </div>
          </div>
        </div>
      )}
      
      {/* Configuration buttons - always shown */}
      <div className="border-t pt-3">
        <div className="flex items-center gap-2 justify-between">
          <button 
            className="text-xs flex items-center gap-1 hover:text-blue-500 transition-colors px-2 py-1 rounded"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/settings?tab=overdue');
            }}
          >
            <Settings className="h-3 w-3" />
            <span>Overdue configuration</span>
          </button>
          <ServerConfigurationButton 
            className="text-xs !p-1" 
            variant="ghost"
            size="sm"
            serverUrl={serverUrl}
            serverName={serverName}
            serverAlias={serverAlias}
              showText={true} 
            />
            {currentUser?.isAdmin && (
              <button
                className="text-xs flex items-center gap-1 text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteBackupJob();
                }}
                disabled={isDeletingBackupJob}
                title="Delete backup job"
              >
                <Trash2 className="h-3 w-3" />
                <span>{isDeletingBackupJob ? 'Deleting...' : 'Delete routine'}</span>
              </button>
            )}
          </div>
          {currentUser?.isAdmin && (
            <div className="text-[10px] text-muted-foreground mt-1 px-2">
              Deletes all records for this routine on this server.
            </div>
          )}
        </div>
    </>
  );
}
