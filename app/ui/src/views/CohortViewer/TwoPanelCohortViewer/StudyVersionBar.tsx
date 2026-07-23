import React, { useState, useEffect, useRef } from 'react';
import styles from './StudyVersionBar.module.css';
import { createStudyVersion, getStudyVersions, getCohortVersions } from '../../../api/text_to_cohort/route';

interface VersionSnapshot {
  version: number;
  name: string;
  description: string;
  created_at: string;
}

interface StudyVersionBarProps {
  studyId: string;
  currentVersion: number;
  cohortId?: string;
  onVersionChange?: () => void;
  onNavigateToVersion?: (version: number) => void;
}

export const StudyVersionBar: React.FC<StudyVersionBarProps> = ({
  studyId,
  currentVersion,
  cohortId,
  onVersionChange,
  onNavigateToVersion,
}) => {
  const [version, setVersion] = useState(currentVersion);
  const [saving, setSaving] = useState(false);
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keep version in sync when parent updates
  useEffect(() => {
    setVersion(currentVersion);
  }, [currentVersion]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [dropdownOpen]);

  const handleSaveVersion = async () => {
    if (saving || !studyId) return;
    setSaving(true);
    try {
      const result = await createStudyVersion(studyId);
      // Navigate to the new version URL — this causes StudyViewer to re-load
      // the correct version via the URL param.
      onNavigateToVersion?.(result.new_version);
      onVersionChange?.();
    } catch (e) {
      console.error('Failed to create version:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!studyId) return;
    const open = !dropdownOpen;
    setDropdownOpen(open);
    if (open) {
      try {
        const snaps = await getStudyVersions(studyId);
        if (cohortId) {
          const validVersions = new Set(await getCohortVersions(cohortId));
          setSnapshots(snaps.filter(s => validVersions.has(s.version)));
        } else {
          setSnapshots(snaps);
        }
      } catch (e) {
        console.error('Failed to load version history:', e);
      }
    }
  };

  const handleRevert = async (targetVersion: number) => {
    if (!studyId) return;
    setDropdownOpen(false);
    // Version is pure URL state — just navigate; StudyViewer re-fetches the right row.
    onNavigateToVersion?.(targetVersion);
    onVersionChange?.();
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      {/* Current version badge */}
      <span className={styles.versionBadge}>v{version}</span>

      {/* Create version button */}
      <button
        className={styles.saveButton}
        onClick={handleSaveVersion}
        disabled={saving}
        title="Create a version snapshot of the current state"
      >
        {saving ? 'Creating…' : 'Create version'}
      </button>

      {/* History toggle */}
      <button
        className={styles.historyButton}
        onClick={handleOpenHistory}
        title="View version history"
      >
        History
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ marginLeft: 4 }}>
          <path d={dropdownOpen ? 'M1 7l4-4 4 4' : 'M1 3l4 4 4-4'} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown list */}
      {dropdownOpen && (
        <div className={styles.dropdown}>
          {snapshots.length === 0 ? (
            <div className={styles.emptyState}>No saved versions yet</div>
          ) : (
            snapshots.map((snap) => (
              <button
                key={snap.version}
                className={styles.snapshotRow}
                onClick={() => handleRevert(snap.version)}
                title={`Restore to v${snap.version}: ${snap.name}`}
              >
                <span className={styles.snapshotVersion}>v{snap.version}</span>
                <span className={styles.snapshotMeta}>
                  <span className={styles.snapshotName}>{snap.name}</span>
                  <span className={styles.snapshotDate}>{formatDate(snap.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
