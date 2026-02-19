import { useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReportSidebar from '@/components/relatorios/ReportSidebar';
import ReportFiltersPanel from '@/components/relatorios/ReportFilters';
import ReportResults from '@/components/relatorios/ReportResults';
import ChartsPanel from '@/components/relatorios/ChartsPanel';
import UsersReportPanel from '@/components/relatorios/UsersReportPanel';
import {
  useSavedReports,
  useSaveReport,
  useDeleteReport,
  useReportQuery,
  type ReportType,
  type ReportFilters,
  type SavedReport,
} from '@/hooks/useReportBuilder';
import { toast } from 'sonner';

const emptyFilters: ReportFilters = {};

export default function RelatoriosPage() {
  const [activeType, setActiveType] = useState<ReportType>('chats');
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [reportName, setReportName] = useState('');
  const [showOnHome, setShowOnHome] = useState(false);
  const [page, setPage] = useState(1);
  const [queryEnabled, setQueryEnabled] = useState(false);

  const { data: savedReports } = useSavedReports();
  const saveReport = useSaveReport();
  const deleteReport = useDeleteReport();

  const { data: results, isLoading } = useReportQuery(activeType, filters, page, queryEnabled);

  const handleSelectType = useCallback((type: ReportType) => {
    setActiveType(type);
    setFilters(emptyFilters);
    setPage(1);
    setQueryEnabled(false);
    setReportName('');
  }, []);

  const handleRun = useCallback(() => {
    setPage(1);
    setQueryEnabled(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!reportName.trim()) {
      toast.error('Dê um nome ao relatório');
      return;
    }
    saveReport.mutate({
      name: reportName,
      report_type: activeType,
      filters,
      show_on_home: showOnHome,
    });
  }, [reportName, activeType, filters, showOnHome, saveReport]);

  const handleLoadReport = useCallback((r: SavedReport) => {
    setActiveType(r.report_type as ReportType);
    setFilters(r.filters);
    setReportName(r.name);
    setShowOnHome(r.show_on_home);
    setPage(1);
    setQueryEnabled(true);
  }, []);

  const showFilters = activeType !== 'charts' && activeType !== 'users';

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      <ReportSidebar
        activeType={activeType}
        onSelectType={handleSelectType}
        savedReports={savedReports ?? []}
        onLoadReport={handleLoadReport}
        onDeleteReport={(id) => deleteReport.mutate(id)}
      />

      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <h1 className="text-lg font-semibold text-foreground">Relatórios</h1>

            {activeType === 'charts' && <ChartsPanel />}
            {activeType === 'users' && <UsersReportPanel />}

            {showFilters && (
              <>
                <ReportFiltersPanel
                  reportType={activeType}
                  filters={filters}
                  onChange={setFilters}
                  onRun={handleRun}
                  onSave={handleSave}
                  reportName={reportName}
                  onNameChange={setReportName}
                  showOnHome={showOnHome}
                  onShowOnHomeChange={setShowOnHome}
                />

                {queryEnabled && (
                  <ReportResults
                    reportType={activeType}
                    rows={results?.rows ?? []}
                    total={results?.total ?? 0}
                    page={page}
                    onPageChange={setPage}
                    isLoading={isLoading}
                  />
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
