import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSelectedRequest, useReportExpandTrigger, useReportCollapseTrigger } from '@/stores/appStore';
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

// Extract preview text from content
function getContentPreview(content: ClaudeContent[]): string {
  for (const block of content) {
    if (block.type === 'text' && 'text' in block) {
      return block.text.replace(/\s+/g, ' ').trim();
    }
    if (block.type === 'tool_use') {
      return `Tool: ${(block as ToolUseContent).name}`;
    }
    if (block.type === 'tool_result') {
      const result = block as ToolResultContent;
      if (typeof result.content === 'string') {
        return result.content.replace(/\s+/g, ' ').trim();
      }
    }
    if (block.type === 'thinking' && 'thinking' in block) {
      return (block as ThinkingContent).thinking.replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

// Message block
function MessageBlock({
  message,
  messageIndex,
  expanded,
  onToggle,
  expandedBlocks,
  onToggleBlock,
}: {
  message: ClaudeMessage;
  messageIndex: number;
  expanded: boolean;
  onToggle: () => void;
  expandedBlocks: Record<string, boolean>;
  onToggleBlock: (key: string) => void;
}) {
  const contentArray = useMemo(() => {
    if (typeof message.content === 'string') {
      return [{ type: 'text' as const, text: message.content }];
    }
    return Array.isArray(message.content) ? message.content : [];
  }, [message.content]);

  const preview = useMemo(() => getContentPreview(contentArray), [contentArray]);

  return (
    <div className={`report-message ${message.role} ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="report-message-header" onClick={onToggle}>
        <span className="report-message-role">{message.role}</span>
        {!expanded && preview && (
          <span className="report-message-preview">{preview}</span>
        )}
      </div>
      {expanded && (
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
      )}
    </div>
  );
}

// Response block (assistant response from API)
function ResponseBlock({
  response,
  requestIndex,
  expanded,
  onToggle,
  expandedBlocks,
  onToggleBlock,
}: {
  response: ClaudeResponse;
  requestIndex: number;
  expanded: boolean;
  onToggle: () => void;
  expandedBlocks: Record<string, boolean>;
  onToggleBlock: (key: string) => void;
}) {
  const contentArray = response.type === 'message' ? response.content || [] : [];
  const preview = useMemo(() => getContentPreview(contentArray), [contentArray]);

  if (response.type === 'error') {
    return (
      <div className="report-message assistant expanded">
        <div className="report-message-header">
          <span className="report-message-role">ASSISTANT (ERROR)</span>
        </div>
        <div className="report-message-content">
          <div className="report-error-block">
            <div className="report-error-type">{response.error.type}</div>
            <div className="report-error-message">{response.error.message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`report-message assistant ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="report-message-header" onClick={onToggle}>
        <span className="report-message-role">
          ASSISTANT
          {response.stop_reason && (
            <span className="report-stop-reason">[{response.stop_reason}]</span>
          )}
        </span>
        {!expanded && preview && (
          <span className="report-message-preview">{preview}</span>
        )}
      </div>
      {expanded && (
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
      )}
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
  messagesExpanded,
  onToggleMessage,
  responseExpanded,
  onToggleResponse,
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
  messagesExpanded: Record<number, boolean>;
  onToggleMessage: (index: number) => void;
  responseExpanded: boolean;
  onToggleResponse: () => void;
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
          expanded={messagesExpanded[index] ?? true}
          onToggle={() => onToggleMessage(index)}
          expandedBlocks={expandedBlocks}
          onToggleBlock={onToggleBlock}
        />
      ))}

      {request.response && (
        <ResponseBlock
          response={request.response}
          requestIndex={requestIndex}
          expanded={responseExpanded}
          onToggle={onToggleResponse}
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

// Main report view component
export function SessionReportView() {
  const selectedRequest = useSelectedRequest();

  // Expanded state management
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>(
    {}
  );
  const [systemExpanded, setSystemExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [toolItemsExpanded, setToolItemsExpanded] = useState<
    Record<number, boolean>
  >({});
  const [toolSchemasExpanded, setToolSchemasExpanded] = useState<
    Record<number, boolean>
  >({});
  const [messagesExpanded, setMessagesExpanded] = useState<
    Record<number, boolean>
  >({});
  const [responseExpanded, setResponseExpanded] = useState(true);

  const toggleBlock = useCallback((key: string) => {
    setExpandedBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleSystem = useCallback(() => {
    setSystemExpanded((prev) => !prev);
  }, []);

  const toggleTools = useCallback(() => {
    setToolsExpanded((prev) => !prev);
  }, []);

  const toggleToolItem = useCallback((toolIndex: number) => {
    setToolItemsExpanded((prev) => ({ ...prev, [toolIndex]: !prev[toolIndex] }));
  }, []);

  const toggleToolSchema = useCallback((toolIndex: number) => {
    setToolSchemasExpanded((prev) => ({ ...prev, [toolIndex]: !prev[toolIndex] }));
  }, []);

  const toggleMessage = useCallback((msgIndex: number) => {
    setMessagesExpanded((prev) => ({ ...prev, [msgIndex]: !(prev[msgIndex] ?? true) }));
  }, []);

  const toggleResponse = useCallback(() => {
    setResponseExpanded((prev) => !prev);
  }, []);

  const expandAll = useCallback(() => {
    if (!selectedRequest) return;

    const newBlocks: Record<string, boolean> = {};
    const newToolItems: Record<number, boolean> = {};
    const newToolSchemas: Record<number, boolean> = {};
    const newMessages: Record<number, boolean> = {};

    selectedRequest.requestBody?.tools?.forEach((_, toolIndex) => {
      newToolItems[toolIndex] = true;
      newToolSchemas[toolIndex] = true;
    });

    selectedRequest.requestBody?.messages?.forEach((message, msgIndex) => {
      newMessages[msgIndex] = true;
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
          newBlocks[`msg-${msgIndex}-${i}`] = true;
        }
      });
    });

    if (selectedRequest.response?.type === 'message') {
      selectedRequest.response.content?.forEach((content, i) => {
        if (
          content.type === 'thinking' ||
          content.type === 'tool_use' ||
          content.type === 'tool_result'
        ) {
          newBlocks[`resp-0-${i}`] = true;
        }
      });
    }

    setExpandedBlocks(newBlocks);
    setSystemExpanded(true);
    setToolsExpanded(true);
    setToolItemsExpanded(newToolItems);
    setToolSchemasExpanded(newToolSchemas);
    setMessagesExpanded(newMessages);
    setResponseExpanded(true);
  }, [selectedRequest]);

  const collapseAll = useCallback(() => {
    setExpandedBlocks({});
    setSystemExpanded(false);
    setToolsExpanded(false);
    setToolItemsExpanded({});
    setToolSchemasExpanded({});
    setMessagesExpanded({});
    setResponseExpanded(false);
  }, []);

  // Reset expanded state when selected request changes
  useEffect(() => {
    setExpandedBlocks({});
    setSystemExpanded(false);
    setToolsExpanded(false);
    setToolItemsExpanded({});
    setToolSchemasExpanded({});
    setMessagesExpanded({});
    setResponseExpanded(true);
  }, [selectedRequest?.id]);

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

  if (!selectedRequest) {
    return <div className="report-empty">Select a request to view details</div>;
  }

  return (
    <div className="report-container">
      <ScrollArea className="h-full">
        <div className="report-content">
          <RequestReportCard
            request={selectedRequest}
            requestIndex={0}
            expandedBlocks={expandedBlocks}
            onToggleBlock={toggleBlock}
            systemExpanded={systemExpanded}
            onToggleSystem={toggleSystem}
            toolsExpanded={toolsExpanded}
            onToggleTools={toggleTools}
            toolItemsExpanded={toolItemsExpanded}
            onToggleToolItem={toggleToolItem}
            toolSchemasExpanded={toolSchemasExpanded}
            onToggleToolSchema={toggleToolSchema}
            messagesExpanded={messagesExpanded}
            onToggleMessage={toggleMessage}
            responseExpanded={responseExpanded}
            onToggleResponse={toggleResponse}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
