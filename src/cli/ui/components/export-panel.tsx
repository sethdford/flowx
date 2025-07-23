import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { getExportService, ExportOptions, ExportResult, ExportTemplate, BatchExportJob } from '../services/export-service.js';

export interface ExportPanelProps<T> {
  data: T[];
  title?: string;
  defaultFields?: string[];
  visible?: boolean;
  onClose?: () => void;
  onExportComplete?: (result: ExportResult) => void;
}

interface ExportPanelState {
  mode: 'format' | 'options' | 'templates' | 'batch' | 'progress';
  selectedFormat: string;
  filename: string;
  selectedFields: string[];
  includeHeaders: boolean;
  timestamp: boolean;
  chartType: string;
  chartTitle: string;
  selectedTemplate: string;
  isExporting: boolean;
  exportProgress: number;
  lastResult?: ExportResult;
  batchJob?: BatchExportJob;
}

export function ExportPanel<T>({
  data,
  title = 'Data Export',
  defaultFields,
  visible = true,
  onClose,
  onExportComplete
}: ExportPanelProps<T>) {
  const [state, setState] = useState<ExportPanelState>({
    mode: 'format',
    selectedFormat: 'csv',
    filename: '',
    selectedFields: defaultFields || [],
    includeHeaders: true,
    timestamp: true,
    chartType: 'line',
    chartTitle: 'Data Chart',
    selectedTemplate: '',
    isExporting: false,
    exportProgress: 0
  });

  const exportService = getExportService();
  const templates = useMemo(() => exportService.getTemplates(), []);
  const stats = useMemo(() => exportService.getExportStats(), []);

  // Available fields from data
  const availableFields = useMemo(() => {
    if (data.length === 0) return [];
    const firstItem = data[0] as any;
    return Object.keys(firstItem).filter(key => typeof firstItem[key] !== 'object');
  }, [data]);

  // Initialize selected fields if not provided
  useEffect(() => {
    if (state.selectedFields.length === 0 && availableFields.length > 0) {
      setState(prev => ({ ...prev, selectedFields: availableFields.slice(0, 10) }));
    }
  }, [availableFields, state.selectedFields.length]);

  // Handle keyboard input
  useInput((input, key) => {
    if (!visible) return;

    if (state.isExporting) {
      // Only allow escape during export
      if (key.escape) {
        setState(prev => ({ ...prev, isExporting: false, mode: 'format' }));
      }
      return;
    }

    if (key.escape) {
      onClose?.();
    } else if (key.tab) {
      // Cycle through modes
      const modes: ExportPanelState['mode'][] = ['format', 'options', 'templates', 'batch'];
      const currentIndex = modes.indexOf(state.mode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setState(prev => ({ ...prev, mode: modes[nextIndex] }));
    } else if (key.return && state.mode === 'format') {
      // Start export
      performExport();
    } else if (input === 's' && state.mode === 'templates') {
      // Save current settings as template
      saveAsTemplate();
    } else if (input === 'b' && state.mode === 'batch') {
      // Create batch job
      createBatchJob();
    }
  });

  const performExport = async () => {
    setState(prev => ({ ...prev, isExporting: true, exportProgress: 0 }));

    try {
      const options: ExportOptions = {
        format: state.selectedFormat as any,
        filename: state.filename || undefined,
        fields: state.selectedFields.length > 0 ? state.selectedFields : undefined,
        includeHeaders: state.includeHeaders,
        timestamp: state.timestamp,
        chartType: state.selectedFormat === 'chart' ? state.chartType as any : undefined,
        chartOptions: state.selectedFormat === 'chart' ? {
          title: state.chartTitle,
          xAxis: state.selectedFields[0],
          yAxis: state.selectedFields[1],
          width: 800,
          height: 400,
          showGrid: true,
          format: 'html'
        } : undefined
      };

      const result = await exportService.exportData(data, options);
      
      setState(prev => ({ 
        ...prev, 
        isExporting: false, 
        lastResult: result,
        mode: 'progress'
      }));

      onExportComplete?.(result);

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isExporting: false,
        lastResult: {
          success: false,
          filename: '',
          filepath: '',
          size: 0,
          recordCount: 0,
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  };

  const saveAsTemplate = () => {
    const options: ExportOptions = {
      format: state.selectedFormat as any,
      fields: state.selectedFields.length > 0 ? state.selectedFields : undefined,
      includeHeaders: state.includeHeaders,
      timestamp: state.timestamp,
      chartType: state.selectedFormat === 'chart' ? state.chartType as any : undefined
    };

    const templateId = exportService.createTemplate(
      `Template ${new Date().toLocaleTimeString()}`,
      options,
      `Auto-saved template for ${state.selectedFormat} export`
    );

    // Could show notification here
  };

  const createBatchJob = () => {
    // Create a sample batch job with multiple formats
    const formats = ['csv', 'json', 'xml'];
    const exports = formats.map(format => ({
      data,
      options: {
        format: format as any,
        fields: state.selectedFields,
        includeHeaders: state.includeHeaders,
        timestamp: state.timestamp
      }
    }));

    const jobId = exportService.createBatchJob(`Batch Export ${new Date().toLocaleTimeString()}`, exports);
    
    // Execute the batch job
    exportService.executeBatchJob(jobId).then(job => {
      setState(prev => ({ ...prev, batchJob: job }));
    });
  };

  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="magenta" bold>📤 {title}</Text>
        <Text color="gray">
          {state.mode.toUpperCase()} | {data.length} records | Tab: Switch | Esc: Close
        </Text>
      </Box>

      {/* Content based on mode */}
      {state.isExporting ? (
        <ExportProgressPanel 
          progress={state.exportProgress}
          format={state.selectedFormat}
        />
      ) : (
        <>
          {state.mode === 'format' && (
            <FormatSelectionPanel
              selectedFormat={state.selectedFormat}
              onFormatChange={(format) => setState(prev => ({ ...prev, selectedFormat: format }))}
              filename={state.filename}
              onFilenameChange={(filename) => setState(prev => ({ ...prev, filename }))}
              chartType={state.chartType}
              onChartTypeChange={(chartType) => setState(prev => ({ ...prev, chartType }))}
              chartTitle={state.chartTitle}
              onChartTitleChange={(chartTitle) => setState(prev => ({ ...prev, chartTitle }))}
            />
          )}

          {state.mode === 'options' && (
            <OptionsPanel
              availableFields={availableFields}
              selectedFields={state.selectedFields}
              onFieldsChange={(fields) => setState(prev => ({ ...prev, selectedFields: fields }))}
              includeHeaders={state.includeHeaders}
              onIncludeHeadersChange={(include) => setState(prev => ({ ...prev, includeHeaders: include }))}
              timestamp={state.timestamp}
              onTimestampChange={(timestamp) => setState(prev => ({ ...prev, timestamp }))}
            />
          )}

          {state.mode === 'templates' && (
            <TemplatesPanel
              templates={templates}
              onLoadTemplate={(template) => {
                setState(prev => ({
                  ...prev,
                  selectedFormat: template.options.format,
                  selectedFields: template.options.fields || [],
                  includeHeaders: template.options.includeHeaders !== false,
                  timestamp: template.options.timestamp !== false,
                  chartType: template.options.chartType || 'line',
                  selectedTemplate: template.id
                }));
              }}
            />
          )}

          {state.mode === 'batch' && (
            <BatchPanel
              stats={stats}
              batchJob={state.batchJob}
            />
          )}

          {state.mode === 'progress' && state.lastResult && (
            <ResultPanel result={state.lastResult} />
          )}
        </>
      )}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
        <Text color="gray" dimColor>
          Actions: [Enter] Export • [S] Save Template • [B] Batch Export • [Tab] Switch Mode
        </Text>
      </Box>
    </Box>
  );
}

// Format Selection Panel
interface FormatSelectionPanelProps {
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  filename: string;
  onFilenameChange: (filename: string) => void;
  chartType: string;
  onChartTypeChange: (type: string) => void;
  chartTitle: string;
  onChartTitleChange: (title: string) => void;
}

function FormatSelectionPanel({
  selectedFormat,
  onFormatChange,
  filename,
  onFilenameChange,
  chartType,
  onChartTypeChange,
  chartTitle,
  onChartTitleChange
}: FormatSelectionPanelProps) {
  const formats = [
    { label: '📊 CSV - Comma Separated Values', value: 'csv' },
    { label: '📋 JSON - JavaScript Object Notation', value: 'json' },
    { label: '📄 XML - Extensible Markup Language', value: 'xml' },
    { label: '📝 YAML - YAML Ain\'t Markup Language', value: 'yaml' },
    { label: '📈 Chart - Visual Chart', value: 'chart' }
  ];

  const chartTypes = [
    { label: '📈 Line Chart', value: 'line' },
    { label: '📊 Bar Chart', value: 'bar' },
    { label: '🔴 Scatter Plot', value: 'scatter' }
  ];

  return (
    <Box flexDirection="column">
      <Text color="white" bold>Export Format:</Text>
      <Box flexDirection="column" marginLeft={2} marginBottom={1}>
        {formats.map(format => (
          <Text 
            key={format.value}
            color={selectedFormat === format.value ? 'cyan' : 'white'}
            backgroundColor={selectedFormat === format.value ? 'blue' : undefined}
          >
            {selectedFormat === format.value ? '► ' : '  '}{format.label}
          </Text>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text color="white" bold>Filename (optional): </Text>
        <Text color="cyan">{filename || 'auto-generated'}</Text>
      </Box>

      {selectedFormat === 'chart' && (
        <Box flexDirection="column" marginLeft={2}>
          <Text color="yellow" bold>Chart Options:</Text>
          <Text color="white">Type: <Text color="cyan">{chartType}</Text></Text>
          <Text color="white">Title: <Text color="cyan">{chartTitle}</Text></Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use options panel to configure fields and settings
        </Text>
      </Box>
    </Box>
  );
}

// Options Panel
interface OptionsPanelProps {
  availableFields: string[];
  selectedFields: string[];
  onFieldsChange: (fields: string[]) => void;
  includeHeaders: boolean;
  onIncludeHeadersChange: (include: boolean) => void;
  timestamp: boolean;
  onTimestampChange: (timestamp: boolean) => void;
}

function OptionsPanel({
  availableFields,
  selectedFields,
  onFieldsChange,
  includeHeaders,
  onIncludeHeadersChange,
  timestamp,
  onTimestampChange
}: OptionsPanelProps) {
  return (
    <Box flexDirection="column">
      <Text color="white" bold>Export Options:</Text>
      
      <Box marginTop={1}>
        <Text color="white">Include Headers: </Text>
        <Text color={includeHeaders ? 'green' : 'red'}>
          {includeHeaders ? '✓ Yes' : '✗ No'}
        </Text>
      </Box>

      <Box>
        <Text color="white">Add Timestamp: </Text>
        <Text color={timestamp ? 'green' : 'red'}>
          {timestamp ? '✓ Yes' : '✗ No'}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="white" bold>Selected Fields ({selectedFields.length}):</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2}>
        {selectedFields.slice(0, 8).map(field => (
          <Text key={field} color="cyan">• {field}</Text>
        ))}
        {selectedFields.length > 8 && (
          <Text color="gray">... and {selectedFields.length - 8} more</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">Available Fields ({availableFields.length}):</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2}>
        {availableFields.slice(0, 5).map(field => (
          <Text 
            key={field} 
            color={selectedFields.includes(field) ? 'green' : 'gray'}
          >
            {selectedFields.includes(field) ? '✓' : '○'} {field}
          </Text>
        ))}
        {availableFields.length > 5 && (
          <Text color="gray">... and {availableFields.length - 5} more</Text>
        )}
      </Box>
    </Box>
  );
}

// Templates Panel
interface TemplatesPanelProps {
  templates: ExportTemplate[];
  onLoadTemplate: (template: ExportTemplate) => void;
}

function TemplatesPanel({ templates, onLoadTemplate }: TemplatesPanelProps) {
  if (templates.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="gray" dimColor>No saved templates</Text>
        <Text color="gray" dimColor>Configure export settings and press 'S' to save as template</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="white" bold>Saved Templates ({templates.length}):</Text>
      
      {templates.slice(0, 5).map(template => (
        <Box key={template.id} flexDirection="column" marginTop={1} marginLeft={2}>
          <Text color="cyan" bold>{template.name}</Text>
          <Text color="gray">
            Format: {template.options.format} • Used: {template.useCount} times
          </Text>
          <Text color="gray">
            Last used: {template.lastUsed.toLocaleDateString()}
          </Text>
          {template.description && (
            <Text color="gray" dimColor>{template.description}</Text>
          )}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Click templates to load (interactive mode coming soon)
        </Text>
      </Box>
    </Box>
  );
}

// Batch Panel
interface BatchPanelProps {
  stats: any;
  batchJob?: BatchExportJob;
}

function BatchPanel({ stats, batchJob }: BatchPanelProps) {
  return (
    <Box flexDirection="column">
      <Text color="white" bold>Batch Export:</Text>
      
      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        <Text color="cyan">Total Exports: {stats.totalExports}</Text>
        <Text color="cyan">Completed Jobs: {stats.completedJobs}</Text>
        <Text color="cyan">Total Size: {(stats.totalSize / 1024).toFixed(1)} KB</Text>
      </Box>

      {batchJob && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow" bold>Current Batch Job:</Text>
          <Text color="white">Status: <Text color="cyan">{batchJob.status}</Text></Text>
          <Text color="white">Progress: <Text color="cyan">{batchJob.progress.toFixed(1)}%</Text></Text>
          <Text color="white">Results: <Text color="cyan">{batchJob.results.length}</Text></Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press 'B' to create batch job with multiple formats
        </Text>
      </Box>
    </Box>
  );
}

// Export Progress Panel
interface ExportProgressPanelProps {
  progress: number;
  format: string;
}

function ExportProgressPanel({ progress, format }: ExportProgressPanelProps) {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={8}>
      {(Spinner as any)({ type: "dots" })}
      <Text color="cyan" bold>Exporting to {format.toUpperCase()}...</Text>
      <Text color="gray">Progress: {progress.toFixed(1)}%</Text>
      <Text color="gray" dimColor>Press Esc to cancel</Text>
    </Box>
  );
}

// Result Panel
interface ResultPanelProps {
  result: ExportResult;
}

function ResultPanel({ result }: ResultPanelProps) {
  return (
    <Box flexDirection="column">
      <Text color={result.success ? 'green' : 'red'} bold>
        {result.success ? '✅ Export Successful!' : '❌ Export Failed'}
      </Text>
      
      {result.success ? (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Text color="white">File: <Text color="cyan">{result.filename}</Text></Text>
          <Text color="white">Size: <Text color="cyan">{(result.size / 1024).toFixed(1)} KB</Text></Text>
          <Text color="white">Records: <Text color="cyan">{result.recordCount}</Text></Text>
          <Text color="white">Duration: <Text color="cyan">{result.duration}ms</Text></Text>
          <Text color="white">Path: <Text color="gray" dimColor>{result.filepath}</Text></Text>
        </Box>
      ) : (
        <Box marginLeft={2} marginTop={1}>
          <Text color="red">Error: {result.error}</Text>
        </Box>
      )}
    </Box>
  );
}

export default ExportPanel; 