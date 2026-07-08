import { FC, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudyViewer } from './StudyViewer';
import { UnauthorizedPage } from '../ErrorPages/UnauthorizedPage';
import { NotFoundPage } from '../ErrorPages/NotFoundPage';
import { getStudy } from '@/api/text_to_cohort/route';
import { TwoPanelCohortViewer } from '../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { chatPanelDataService } from '../ChatPanel/ChatPanelDataService';
import { useThreePanelCollapse } from '@/contexts/ThreePanelCollapseContext';
import { PrefillProgressPanel, CohortPrefillItem } from './PrefillProgressPanel/PrefillProgressPanel';
import type { StudyIntake } from './NewStudyWizard/StudyIntakeWizard';

interface StudyViewerWrapperProps {
  data?: string;
}

export const StudyViewerWrapper: FC<StudyViewerWrapperProps> = ({ data }) => {
  const [error, setError] = useState<'unauthorized' | 'not-found' | null>(null);
  const [loading, setLoading] = useState(true);
  const [prefillCohorts, setPrefillCohorts] = useState<CohortPrefillItem[]>([]);
  const [searchParams] = useSearchParams();
  const { setRightPanelShown } = useThreePanelCollapse();

  useEffect(() => {
    // Activate study mode for the AI chat whenever a study is open
    if (data) {
      chatPanelDataService.setStudyMode(data);
    }
  }, [data]);

  // Handle AI prefill triggered by ?prefill=true
  useEffect(() => {
    if (!data || loading) return;
    if (searchParams.get('prefill') !== 'true') return;

    const intakeRaw = sessionStorage.getItem(`intake_${data}`);
    if (!intakeRaw) return;

    try {
      const intake: StudyIntake = JSON.parse(intakeRaw);
      sessionStorage.removeItem(`intake_${data}`);

      const uploadedFiles = intake.codelistFiles?.map(f => f.filename).filter(Boolean) ?? [];
      const codelistContext = [
        ...(uploadedFiles.length > 0 ? [`Uploaded codelist files: ${uploadedFiles.join(', ')}`] : []),
        ...(intake.codelistNotes ? [intake.codelistNotes] : []),
      ].join('\n');

      // Build one focused prompt per cohort so the agent can act on a manageable scope.
      // Each prompt targets a single cohort and refers to the placeholder phenotypes
      // already created in the study shell — the agent just needs to UPDATE them.
      const validCohorts = intake.cohorts.filter(c => c.name.trim());

      const buildCohortPrompt = (c: typeof validCohorts[0], index: number, total: number) => {
        const inc = c.inclusions.filter(Boolean);
        const exc = c.exclusions.filter(Boolean);

        const lines: string[] = [
          `Cohort ${index + 1} of ${total}: "${c.name}"`,
          c.description ? `Description: ${c.description}` : '',
          c.entry_criterion ? `Entry criterion (index date): ${c.entry_criterion}` : '',
          '',
          `The study shell already contains placeholder phenotypes for this cohort with empty codelists.`,
          `For each placeholder listed below, please UPDATE it — set the correct domain and assign a`,
          `codelist name. Do NOT create new phenotypes; just fill in the existing ones.`,
          '',
        ];

        if (c.entry_criterion) {
          lines.push(`Entry criterion placeholder to update:`);
          lines.push(`  • ${c.entry_criterion.toUpperCase()} — set domain + codelist`);
          lines.push('');
        }

        if (inc.length) {
          lines.push('Inclusion criteria placeholders to update:');
          inc.forEach(s => lines.push(`  • ${s.toUpperCase()} — set domain + codelist`));
          lines.push('');
        }
        if (exc.length) {
          lines.push('Exclusion criteria placeholders to update:');
          exc.forEach(s => lines.push(`  • ${s.toUpperCase()} — set domain + codelist`));
          lines.push('');
        }

        lines.push('Also add an entry criterion for this cohort if none exists.');

        if (codelistContext) {
          lines.push('', 'Codelist context:', codelistContext);
        }

        return lines.filter(l => l !== undefined).join('\n');
      };

      if (validCohorts.length === 0) return;

      setRightPanelShown(true);

      // Initialise progress panel — all cohorts waiting
      setPrefillCohorts(validCohorts.map(c => ({ name: c.name, status: 'waiting' as const })));

      let currentIndex = 0;

      const sendNext = () => {
        if (currentIndex >= validCohorts.length) {
          // Mark last cohort done
          setPrefillCohorts(prev => prev.map((c, i) =>
            i === currentIndex - 1 ? { ...c, status: 'done' } : c
          ));
          return;
        }
        const cohort = validCohorts[currentIndex];
        const idx = currentIndex;
        // Mark previous done, current active
        setPrefillCohorts(prev => prev.map((c, i) => {
          if (i === idx - 1) return { ...c, status: 'done' };
          if (i === idx) return { ...c, status: 'active' };
          return c;
        }));
        const prompt = buildCohortPrompt(cohort, idx, validCohorts.length);
        currentIndex++;
        chatPanelDataService.addUserMessageWithText(prompt);
        chatPanelDataService.onAICompletion(sendNext);
      };

      setTimeout(sendNext, 1500);
    } catch (e) {
      console.error('Failed to trigger AI prefill:', e);
    }
  }, [data, loading, searchParams]);

  useEffect(() => {
    const checkStudyAccess = async () => {
      if (!data) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Try to fetch the study to check access
        await getStudy(data);
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading study:', err);
        const status = err?.response?.status || err?.status;
        
        if (status === 401 || status === 403) {
          setError('unauthorized');
        } else if (status === 404) {
          setError('not-found');
        }
        setLoading(false);
      }
    };

    checkStudyAccess();
  }, [data]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        color: 'var(--text-color-secondary)'
      }}>
        Loading study...
      </div>
    );
  }

  if (error === 'unauthorized') {
    return <UnauthorizedPage />;
  }

  if (error === 'not-found') {
    return <NotFoundPage />;
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {prefillCohorts.length > 0 && (
        <PrefillProgressPanel
          cohorts={prefillCohorts}
          onDismiss={() => setPrefillCohorts([])}
        />
      )}
      <TwoPanelCohortViewer data={data} contentMode="study" />
    </div>
  );
};
