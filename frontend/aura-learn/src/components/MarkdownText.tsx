import React, { useMemo } from "react";

interface MarkdownTextProps {
    content: string;
    className?: string;
}

/**
 * Lightweight Markdown-lite renderer that handles:
 * - **bold**
 * - *italic*
 * - \n (newlines)
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ content, className }) => {
    const html = useMemo(() => {
        if (!content) return "";

        // Replace markdown patterns with HTML equivalents
        // Using a safer multi-pass approach to avoid greedy matching issues
        let result = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br />');

        return result;
    }, [content]);

    return (
        <div
            className={className}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};
