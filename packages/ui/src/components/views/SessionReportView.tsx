import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore, useSelectedSessionId, useReportExpandTrigger, useReportCollapseTrigger } from '@/stores/appStore';
import { formatDuration, extractModelName } from '@/lib/utils';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import type {
  Request,
  ClaudeMessage,
  ClaudeContent,
  TextContent,
  ToolUseContent,
  ToolResultContent,
  ThinkingContent,
  ClaudeTool,
  SystemBlock,
  ClaudeResponse,
} from '@/lib/types';
import './SessionReportView.css';

const jsonStyles = {
  ...defaultStyles,
  container: 'json-view text-xs',
  basicChildStyle: 'text-foreground',
  label: 'text-blue-400',
  nullValue: 'text-gray-500',
  stringValue: 'text-green-400',
  booleanValue: 'text-yellow-400',
  numberValue: 'text-purple-400',
  punctuation: 'text-gray-500',
};

// JSON syntax highlighter
function highlightJson(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
          match = match.slice(0, -1); // remove trailing colon
          return `<span class="${cls}">${escapeHtml(match)}</span>:`;
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${escapeHtml(match)}</span>`;
    }
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function HighlightedJson({ data }: { data: unknown }) {
  const html = useMemo(() => highlightJson(data), [data]);
  return <pre dangerouslySetInnerHTML={{ __html: html }} />;
}

// Collapsible block component
function CollapsibleBlock({
  header,
  headerClass,
  contentClass,
  children,
  defaultExpanded = false,
  expanded,
  onToggle,
}: {
  header: React.ReactNode;
  headerClass: string;
  contentClass: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded !== undefined ? expanded : internalExpanded;
  const toggle = onToggle || (() => setInternalExpanded(!internalExpanded));

  return (
    <div className={`report-collapsible ${isExpanded ? 'expanded' : ''}`}>
      <div className={headerClass} onClick={toggle}>
        {header}
      </div>
      <div className={contentClass}>{children}</div>
    </div>
  );
}

// System prompt section
function SystemPromptSection({
  system,
  expanded,
  onToggle,
}: {
  system: string | SystemBlock[] | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!system) return null;

  const systemText = useMemo(() => {
    if (typeof system === 'string') return system;
    return system.map((block) => block.text).join('\n\n---\n\n');
  }, [system]);

  return (
    <div className="report-system-block">
      <CollapsibleBlock
        header="SYSTEM PROMPT"
        headerClass="report-system-header"
        contentClass="report-system-content"
        expanded={expanded}
        onToggle={onToggle}
      >
        <pre>{systemText}</pre>
      </CollapsibleBlock>
    </div>
  );
}

// Tools section
function ToolsSection({
  tools,
  expanded,
  onToggle,
  toolItemsExpanded,
  onToggleToolItem,
  toolSchemasExpanded,
  onToggleToolSchema,
}: {
  tools: ClaudeTool[] | undefined;
  expanded: boolean;
  onToggle: () => void;
  toolItemsExpanded: Record<number, boolean>;
  onToggleToolItem: (index: number) => void;
  toolSchemasExpanded: Record<number, boolean>;
  onToggleToolSchema: (index: number) => void;
}) {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="report-tools-block">
      <CollapsibleBlock
        header={`AVAILABLE TOOLS (${tools.length})`}
        headerClass="report-tools-header"
        contentClass="report-tools-list"
        expanded={expanded}
        onToggle={onToggle}
      >
        {tools.map((tool, index) => (
          <div
            key={index}
            className={`report-tool-item ${toolItemsExpanded[index] ? 'expanded' : ''}`}
          >
            <div
              className="report-tool-item-header"
              onClick={() => onToggleToolItem(index)}
            >
              {tool.name}
            </div>
            <div className="report-tool-item-description">
              {tool.description || 'No description'}
            </div>
            <div
              className={`report-tool-item-schema-wrapper ${toolSchemasExpanded[index] ? 'schema-expanded' : ''}`}
            >
              <div
                className="report-tool-item-schema-header"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleToolSchema(index);
                }}
              >
                Input Schema
              </div>
              <div className="report-tool-item-schema">
                <HighlightedJson data={tool.input_schema} />
              </div>
            </div>
          </div>
        ))}
      </CollapsibleBlock>
    </div>
  );
}

// Thinking block
function ThinkingBlock({
  thinking,
  expanded,
  onToggle,
}: {
  thinking: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`report-thinking-block ${expanded ? 'expanded' : ''}`}>
      <div className="report-thinking-header" onClick={onToggle}>
        THINKING
      </div>
      <div className="report-thinking-content">
        <pre>{thinking}</pre>
      </div>
    </div>
  );
}

// Tool use block
function ToolUseBlock({
  toolUse,
  expanded,
  onToggle,
}: {
  toolUse: ToolUseContent;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`report-tool-use-block ${expanded ? 'expanded' : ''}`}>
      <div className="report-tool-header" onClick={onToggle}>
        TOOL CALL: <span className="report-tool-name">{toolUse.name}</span>
      </div>
      <div className="report-tool-input">
        <HighlightedJson data={toolUse.input} />
      </div>
    </div>
  );
}

// Tool result block
function ToolResultBlock({
  toolResult,
  expanded,
  onToggle,
}: {
  toolResult: ToolResultContent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const contentText = useMemo(() => {
    if (typeof toolResult.content === 'string') {
      return toolResult.content;
    }
    if (Array.isArray(toolResult.content)) {
      return toolResult.content
        .map((c) => {
          if ('text' in c) return c.text;
          return JSON.stringify(c);
        })
        .join('\n');
    }
    return JSON.stringify(toolResult.content);
  }, [toolResult.content]);

  return (
    <div
      className={`report-tool-result-block ${expanded ? 'expanded' : ''} ${toolResult.is_error ? 'error' : ''}`}
    >
      <div className="report-tool-result-header" onClick={onToggle}>
        TOOL RESULT
      </div>
      <div className="report-tool-result-content">
        <pre>{contentText}</pre>
      </div>
    </div>
  );
}

// Content block renderer
function ContentBlockRenderer({
  content,
  blockKey,
  expandedBlocks,
  onToggleBlock,
}: {
  content: ClaudeContent;
  blockKey: string;
  expandedBlocks: Record<string, boolean>;
  onToggleBlock: (key: string) => void;
}) {
  if (content.type === 'text') {
    const textContent = content as TextContent;
    return <div className="report-text-block">{textContent.text}</div>;
  }

  if (content.type === 'thinking') {
    const thinkingContent = content as ThinkingContent;
    return (
      <ThinkingBlock
        thinking={thinkingContent.thinking}
        expanded={expandedBlocks[blockKey] ?? false}
        onToggle={() => onToggleBlock(blockKey)}
      />
    );
  }

  if (content.type === 'tool_use') {
    return (
      <ToolUseBlock
        toolUse={content as ToolUseContent}
        expanded={expandedBlocks[blockKey] ?? false}
        onToggle={() => onToggleBlock(blockKey)}
      />
    );
  }

  if (content.type === 'tool_result') {
    return (
      <ToolResultBlock
        toolResult={content as ToolResultContent}
        expanded={expandedBlocks[blockKey] ?? false}
        onToggle={() => onToggleBlock(blockKey)}
      />
    );
  }

  // Fallback for other types
  return (
    <div className="report-text-block">
      <JsonView data={content} style={jsonStyles} />
    </div>
  );
}

// Message block
function MessageBlock({
  message,
  messageIndex,
  expandedBlocks,
  onToggleBlock,
}: {
  message: ClaudeMessage;
  messageIndex: number;
  expandedBlocks: Record<string, boolean>;
  onToggleBlock: (key: string) => void;
}) {
  const contentArray = useMemo(() => {
    if (typeof message.content === 'string') {
      return [{ type: 'text' as const, text: message.content }];
    }
    return Array.isArray(message.content) ? message.content : [];
  }, [message.content]);

  return (
    <div className={`report-message ${message.role}`}>
      <div className="report-message-header">{message.role}</div>
      <div className="report-message-content">
        {contentArray.map((content, i) => (
          <div key={i} className="report-content-block">
            <ContentBlockRenderer
              content={content}
              blockKey={`msg-${messageIndex}-${i}`}
              expandedBlocks={expandedBlocks}
              onToggleBlock={onToggleBlock}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Response block (assistant response from API)
function ResponseBlock({
  response,
  requestIndex,
  expandedBlocks,
  onToggleBlock,
}: {
  response: ClaudeResponse;
  requestIndex: number;
  expandedBlocks: Record<string, boolean>;
  onToggleBlock: (key: string) => void;
}) {
  if (response.type === 'error') {
    return (
      <div className="report-message assistant">
        <div className="report-message-header">ASSISTANT (ERROR)</div>
        <div className="report-message-content">
          <div className="report-error-block">
            <div className="report-error-type">{response.error.type}</div>
            <div className="report-error-message">{response.error.message}</div>
          </div>
        </div>
      </div>
    );
  }

  const contentArray = response.content || [];

  return (
    <div className="report-message assistant">
      <div className="report-message-header">
        ASSISTANT
        {response.stop_reason && (
          <span className="report-stop-reason">[{response.stop_reason}]</span>
        )}
      </div>
      <div className="report-message-content">
        {contentArray.map((content, i) => (
          <div key={i} className="report-content-block">
            <ContentBlockRenderer
              content={content}
              blockKey={`resp-${requestIndex}-${i}`}
              expandedBlocks={expandedBlocks}
              onToggleBlock={onToggleBlock}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Single request report card
function RequestReportCard({
  request,
  requestIndex,
  expandedBlocks,
  onToggleBlock,
  systemExpanded,
  onToggleSystem,
  toolsExpanded,
  onToggleTools,
  toolItemsExpanded,
  onToggleToolItem,
  toolSchemasExpanded,
  onToggleToolSchema,
}: {
  request: Request;
  requestIndex: number;
  expandedBlocks: Record<string, boolean>;
  onToggleBlock: (key: string) => void;
  systemExpanded: boolean;
  onToggleSystem: () => void;
  toolsExpanded: boolean;
  onToggleTools: () => void;
  toolItemsExpanded: Record<number, boolean>;
  onToggleToolItem: (index: number) => void;
  toolSchemasExpanded: Record<number, boolean>;
  onToggleToolSchema: (index: number) => void;
}) {
  const model = request.requestBody?.model || 'unknown';
  const messages = request.requestBody?.messages || [];
  const msgCount = messages.length;

  return (
    <div className="report-request-card">
      <div className="report-header">
        <h2>Claude Code Trace</h2>
        <div className="report-meta">
          <strong>Model:</strong> {extractModelName(model)} |{' '}
          <strong>Messages:</strong> {msgCount}
          {request.durationMs !== undefined && (
            <>
              {' '}
              | <strong>Duration:</strong> {formatDuration(request.durationMs)}
            </>
          )}
        </div>
      </div>

      <SystemPromptSection
        system={request.requestBody?.system}
        expanded={systemExpanded}
        onToggle={onToggleSystem}
      />

      <ToolsSection
        tools={request.requestBody?.tools}
        expanded={toolsExpanded}
        onToggle={onToggleTools}
        toolItemsExpanded={toolItemsExpanded}
        onToggleToolItem={onToggleToolItem}
        toolSchemasExpanded={toolSchemasExpanded}
        onToggleToolSchema={onToggleToolSchema}
      />

      {messages.map((message, index) => (
        <MessageBlock
          key={index}
          message={message}
          messageIndex={index + requestIndex * 1000}
          expandedBlocks={expandedBlocks}
          onToggleBlock={onToggleBlock}
        />
      ))}

      {request.response && (
        <ResponseBlock
          response={request.response}
          requestIndex={requestIndex}
          expandedBlocks={expandedBlocks}
          onToggleBlock={onToggleBlock}
        />
      )}

      {request.isStreaming && (
        <div className="report-streaming-indicator">Streaming response...</div>
      )}
    </div>
  );
}

// Main session report view component
export function SessionReportView() {
  const selectedSessionId = useSelectedSessionId();
  const getSessionRequests = useAppStore((state) => state.getSessionRequests);

  // Expanded state management
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>(
    {}
  );
  const [systemExpanded, setSystemExpanded] = useState<Record<number, boolean>>(
    {}
  );
  const [toolsExpanded, setToolsExpanded] = useState<Record<number, boolean>>(
    {}
  );
  const [toolItemsExpanded, setToolItemsExpanded] = useState<
    Record<string, boolean>
  >({});
  const [toolSchemasExpanded, setToolSchemasExpanded] = useState<
    Record<string, boolean>
  >({});

  const toggleBlock = useCallback((key: string) => {
    setExpandedBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleSystem = useCallback((reqIndex: number) => {
    setSystemExpanded((prev) => ({ ...prev, [reqIndex]: !prev[reqIndex] }));
  }, []);

  const toggleTools = useCallback((reqIndex: number) => {
    setToolsExpanded((prev) => ({ ...prev, [reqIndex]: !prev[reqIndex] }));
  }, []);

  const toggleToolItem = useCallback((reqIndex: number, toolIndex: number) => {
    const key = `${reqIndex}-${toolIndex}`;
    setToolItemsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleToolSchema = useCallback(
    (reqIndex: number, toolIndex: number) => {
      const key = `${reqIndex}-${toolIndex}`;
      setToolSchemasExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const expandAll = useCallback(() => {
    if (!selectedSessionId) return;
    const requests = getSessionRequests(selectedSessionId);

    const newBlocks: Record<string, boolean> = {};
    const newSystem: Record<number, boolean> = {};
    const newTools: Record<number, boolean> = {};
    const newToolItems: Record<string, boolean> = {};
    const newToolSchemas: Record<string, boolean> = {};

    requests.forEach((request, reqIndex) => {
      newSystem[reqIndex] = true;
      newTools[reqIndex] = true;

      request.requestBody?.tools?.forEach((_, toolIndex) => {
        const key = `${reqIndex}-${toolIndex}`;
        newToolItems[key] = true;
        newToolSchemas[key] = true;
      });

      request.requestBody?.messages?.forEach((message, msgIndex) => {
        const contentArray =
          typeof message.content === 'string'
            ? [{ type: 'text' as const, text: message.content }]
            : message.content || [];
        contentArray.forEach((content, i) => {
          if (
            content.type === 'thinking' ||
            content.type === 'tool_use' ||
            content.type === 'tool_result'
          ) {
            newBlocks[`msg-${msgIndex + reqIndex * 1000}-${i}`] = true;
          }
        });
      });

      if (request.response?.type === 'message') {
        request.response.content?.forEach((content, i) => {
          if (
            content.type === 'thinking' ||
            content.type === 'tool_use' ||
            content.type === 'tool_result'
          ) {
            newBlocks[`resp-${reqIndex}-${i}`] = true;
          }
        });
      }
    });

    setExpandedBlocks(newBlocks);
    setSystemExpanded(newSystem);
    setToolsExpanded(newTools);
    setToolItemsExpanded(newToolItems);
    setToolSchemasExpanded(newToolSchemas);
  }, [selectedSessionId, getSessionRequests]);

  const collapseAll = useCallback(() => {
    setExpandedBlocks({});
    setSystemExpanded({});
    setToolsExpanded({});
    setToolItemsExpanded({});
    setToolSchemasExpanded({});
  }, []);

  // Reset all expanded states when session changes
  useEffect(() => {
    collapseAll();
  }, [selectedSessionId, collapseAll]);

  // Listen to expand/collapse triggers from header
  const expandTrigger = useReportExpandTrigger();
  const collapseTrigger = useReportCollapseTrigger();
  const prevExpandTrigger = useRef(expandTrigger);
  const prevCollapseTrigger = useRef(collapseTrigger);

  useEffect(() => {
    if (expandTrigger > prevExpandTrigger.current) {
      expandAll();
    }
    prevExpandTrigger.current = expandTrigger;
  }, [expandTrigger, expandAll]);

  useEffect(() => {
    if (collapseTrigger > prevCollapseTrigger.current) {
      collapseAll();
    }
    prevCollapseTrigger.current = collapseTrigger;
  }, [collapseTrigger, collapseAll]);

  if (!selectedSessionId) {
    return (
      <div className="report-empty">Select a session to view the report</div>
    );
  }

  const sessionRequests = getSessionRequests(selectedSessionId);

  if (sessionRequests.length === 0) {
    return <div className="report-empty">No requests in this session</div>;
  }

  // Sort by timestamp ascending (oldest first)
  const sortedRequests = [...sessionRequests].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  return (
    <div className="report-container">
      <ScrollArea className="h-full">
        <div className="report-content">
          {sortedRequests.map((request, reqIndex) => (
            <RequestReportCard
              key={request.id}
              request={request}
              requestIndex={reqIndex}
              expandedBlocks={expandedBlocks}
              onToggleBlock={toggleBlock}
              systemExpanded={systemExpanded[reqIndex] ?? false}
              onToggleSystem={() => toggleSystem(reqIndex)}
              toolsExpanded={toolsExpanded[reqIndex] ?? false}
              onToggleTools={() => toggleTools(reqIndex)}
              toolItemsExpanded={Object.fromEntries(
                Object.entries(toolItemsExpanded)
                  .filter(([k]) => k.startsWith(`${reqIndex}-`))
                  .map(([k, v]) => [parseInt(k.split('-')[1]), v])
              )}
              onToggleToolItem={(toolIndex) =>
                toggleToolItem(reqIndex, toolIndex)
              }
              toolSchemasExpanded={Object.fromEntries(
                Object.entries(toolSchemasExpanded)
                  .filter(([k]) => k.startsWith(`${reqIndex}-`))
                  .map(([k, v]) => [parseInt(k.split('-')[1]), v])
              )}
              onToggleToolSchema={(toolIndex) =>
                toggleToolSchema(reqIndex, toolIndex)
              }
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
