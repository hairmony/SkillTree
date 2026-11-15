import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileBarChart, Download, CheckCircle2, Brain, Loader2, Sparkles, FileText } from 'lucide-react';
import { useTreeList } from '@/hooks/useTreeQueries';
import { treesApi, quizzesApi } from '@/api';
import { useGamificationStore, useSettingsStore } from '@/stores';
import { Badge } from '@/components/ui';
import { formatPercent } from '@/lib/utils';
import { toast } from 'sonner';
import type { TreeDetail, QuizHistoryItem } from '@/types';

export default function ReportsPage() {
  const { data: trees } = useTreeList();
  const displayName = useSettingsStore((s) => s.displayName);
  const { xp, level, streakDays, lessonsCompleted, quizzesPassed, achievements } =
    useGamificationStore();

  const [selectedTreeId, setSelectedTreeId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: treeDetail } = useQuery({
    queryKey: ['report-tree', selectedTreeId],
    queryFn: () => treesApi.get(selectedTreeId),
    enabled: !!selectedTreeId,
  });

  const { data: quizHistory } = useQuery({
    queryKey: ['report-quizzes', selectedTreeId],
    queryFn: () => quizzesApi.getHistory(selectedTreeId),
    enabled: !!selectedTreeId,
  });

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const treeTitle = trees?.find((t) => t.id === selectedTreeId)?.title || selectedTreeId || 'All Trees';
      const now = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Header Banner
      doc.setFillColor(11, 16, 32); // #0B1020
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(248, 250, 252);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('SkillTree Learning Progress Report', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(`Learner: ${displayName} | Generated: ${now}`, 14, 30);

      // Section 1: Executive Summary
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', 14, 52);

      const masteredCount =
        treeDetail?.nodes.filter((n) => n.status === 'mastered').length ?? lessonsCompleted;
      const totalCount = treeDetail?.nodes.length ?? 0;
      const completionRate = totalCount > 0 ? formatPercent(masteredCount / totalCount) : 'N/A';

      autoTable(doc, {
        startY: 56,
        head: [['Metric', 'Value', 'Scope']],
        body: [
          ['Current Tree', treeTitle, 'Active Pathway'],
          ['Concepts Mastered', `${masteredCount} / ${totalCount}`, 'DAG Traversal'],
          ['Completion Rate', completionRate, 'Pathway Progress'],
          ['XP & Level', `${xp} XP (Level ${level})`, 'Browser Persistence'],
          ['Continuous Streak', `${streakDays} Days`, 'Daily Deliberate Practice'],
          ['Quizzes Taken', `${quizHistory?.length ?? quizzesPassed}`, 'Assessments Recorded'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        styles: { fontSize: 9 },
      });

      // Section 2: Concepts in Pathway
      if (treeDetail && treeDetail.nodes.length > 0) {
        const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 120;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Curriculum Concepts & Status', 14, lastY + 12);

        const nodeRows = treeDetail.nodes.map((n) => [
          n.title,
          n.kind,
          n.status.toUpperCase(),
          n.mastery > 0 ? `${Math.round(n.mastery * 100)}%` : '0%',
        ]);

        autoTable(doc, {
          startY: lastY + 16,
          head: [['Concept Title', 'Kind', 'State', 'BKT Mastery']],
          body: nodeRows,
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59] },
          styles: { fontSize: 8 },
        });
      }

      // Section 3: Assessment History
      if (quizHistory && quizHistory.length > 0) {
        const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 180;
        if (lastY > 230) doc.addPage();

        const currentY = lastY > 230 ? 20 : lastY + 12;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Assessment History & Dynamic Remediation', 14, currentY);

        const quizRows = quizHistory.map((q) => [
          `#${q.quiz_id}`,
          q.title || q.node_id,
          formatPercent(q.score),
          q.score >= 0.75 ? 'PASSED' : 'NEEDS REVIEW',
          q.added_nodes.length > 0 ? `${q.added_nodes.length} nodes added` : 'None',
        ]);

        autoTable(doc, {
          startY: currentY + 4,
          head: [['Quiz ID', 'Concept', 'Score', 'Verdict', 'Remediation Branches']],
          body: quizRows,
          theme: 'striped',
          headStyles: { fillColor: [34, 197, 94] },
          styles: { fontSize: 8 },
        });
      }

      // Footer
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `SkillTree Research Platform · Page ${i} of ${pageCount} · Grounded in Bayesian Knowledge Tracing`,
          14,
          290
        );
      }

      doc.save(`skilltree-report-${selectedTreeId || 'overview'}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Report PDF successfully exported');
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Research Progress & Assessment Reports</h2>
        <p className="text-sm text-text-secondary mt-1">
          Export formal PDF records of learning achievements, DAG concept mastery, and quiz performance
        </p>
      </div>

      {/* Generator Controls */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-text-primary">Generate PDF Progress Report</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Select Skill Tree for Curriculum Breakdown
            </label>
            <select
              value={selectedTreeId}
              onChange={(e) => setSelectedTreeId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">-- All Activity Overview --</option>
              {trees?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Rendering PDF Document...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download PDF Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview Summary Card */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-text-primary">Report Contents Preview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-dark-primary border border-dark-elevated">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-semibold text-xs text-text-primary">Concept Mastery</span>
            </div>
            <p className="text-xs text-text-secondary">
              Includes full table of completed and pending nodes with individual Bayesian Knowledge Tracing scores.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-dark-primary border border-dark-elevated">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-accent-purple" />
              <span className="font-semibold text-xs text-text-primary">Assessment Verdicts</span>
            </div>
            <p className="text-xs text-text-secondary">
              Includes pass/fail records, score fractions, and dynamic DAG remediation nodes synthesized after quizzes.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-dark-primary border border-dark-elevated">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-warning" />
              <span className="font-semibold text-xs text-text-primary">Research Integrity</span>
            </div>
            <p className="text-xs text-text-secondary">
              Explicitly demarcates SQLite backend-verified metrics from browser-local gamification state.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
